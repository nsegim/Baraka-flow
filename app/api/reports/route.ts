import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { serialize } from "@/lib/serialize"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const businessId = session.user.businessId

    // Optional ?month=YYYY-MM filter for P&L scoping
    const monthParam = request.nextUrl.searchParams.get("month")

    const now            = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0)

    // P&L date range — default to current month
    let plStart = thisMonthStart
    let plEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    if (monthParam) {
      const [year, mon] = monthParam.split("-").map(Number)
      plStart = new Date(year, mon - 1, 1)
      plEnd   = new Date(year, mon, 0, 23, 59, 59)
    }

    const [
      totalRevenue,
      thisMonthRevenue,
      lastMonthRevenue,
      plRevenue,
      plExpenses,
      totalOrders,
      deliveredOrders,
      pendingOrders,
      cancelledOrders,
      totalProducts,
      allProducts,
    ] = await Promise.all([
      prisma.order.aggregate({
        where: { businessId, status: "DELIVERED" },
        _sum:  { totalAmount: true },
      }),
      prisma.order.aggregate({
        where: { businessId, status: "DELIVERED", createdAt: { gte: thisMonthStart } },
        _sum:  { totalAmount: true },
      }),
      prisma.order.aggregate({
        where: { businessId, status: "DELIVERED", createdAt: { gte: lastMonthStart, lte: lastMonthEnd } },
        _sum:  { totalAmount: true },
      }),
      // P&L: revenue in the selected period
      prisma.order.aggregate({
        where: { businessId, status: "DELIVERED", createdAt: { gte: plStart, lte: plEnd } },
        _sum:  { totalAmount: true },
      }),
      // P&L: expenses in the selected period — raw SQL avoids client-gen dependency
      prisma.$queryRaw<{ total: string | null }[]>`
        SELECT COALESCE(SUM(amount), 0)::text AS total
        FROM "Expense"
        WHERE "businessId" = ${businessId}
          AND date >= ${plStart} AND date <= ${plEnd}
      `.catch(() => [{ total: "0" }]),
      prisma.order.count({ where: { businessId } }),
      prisma.order.count({ where: { businessId, status: "DELIVERED" } }),
      prisma.order.count({ where: { businessId, status: "PENDING"   } }),
      prisma.order.count({ where: { businessId, status: "CANCELLED" } }),
      prisma.product.count({ where: { businessId } }),
      prisma.product.findMany({
        where:  { businessId },
        select: { stock: true, minStock: true },
      }),
    ])

    const lowStockCount   = allProducts.filter((p: { stock: number; minStock: number }) => p.stock > 0 && p.stock <= p.minStock).length
    const outOfStockCount = allProducts.filter((p: { stock: number }) => p.stock === 0).length

    const plRevenueVal  = Number(plRevenue._sum.totalAmount ?? 0)
    const plExpenseVal  = Number((plExpenses as { total: string | null }[])[0]?.total ?? 0)
    const plProfit      = plRevenueVal - plExpenseVal
    const plMargin      = plRevenueVal > 0 ? Math.round((plProfit / plRevenueVal) * 100) : 0

    // Monthly revenue trend — last 6 months
    const trendStart = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    type TrendRow = { month: string; revenue: string; orders: string }
    const monthlyTrendRaw = await prisma.$queryRaw<TrendRow[]>`
      SELECT
        TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') AS month,
        COALESCE(SUM("totalAmount"), 0)::text                AS revenue,
        COUNT(*)::text                                        AS orders
      FROM "Order"
      WHERE "businessId" = ${businessId}
        AND status = 'DELIVERED'
        AND "createdAt" >= ${trendStart}
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY DATE_TRUNC('month', "createdAt") ASC
    `
    const monthlyTrend = monthlyTrendRaw.map(r => ({
      month:   r.month,
      revenue: Number(r.revenue),
      orders:  Number(r.orders),
    }))

    // Single JOIN query replaces the previous N+1 loop.
    // Uses unitPrice from OrderItem (price at time of sale) — more accurate than current price.
    type TopProductRow = { name: string; totalSold: bigint; revenue: bigint }
    const topProductsRaw = await prisma.$queryRaw<TopProductRow[]>`
      SELECT
        p.name,
        SUM(oi.quantity)                    AS "totalSold",
        SUM(oi.quantity * oi."unitPrice")   AS "revenue"
      FROM "OrderItem" oi
      JOIN "Product" p  ON p.id  = oi."productId"
      JOIN "Order"   o  ON o.id  = oi."orderId"
      WHERE o."businessId" = ${businessId}
        AND o.status = 'DELIVERED'
      GROUP BY p.id, p.name
      ORDER BY "totalSold" DESC
      LIMIT 5
    `

    // $queryRaw returns BigInt for aggregated integer columns — convert to Number
    const topProducts = topProductsRaw.map(row => ({
      name:      row.name,
      totalSold: Number(row.totalSold),
      revenue:   Number(row.revenue),
    }))

    return NextResponse.json(serialize({
      revenue: {
        total:     totalRevenue._sum.totalAmount     ?? 0,
        thisMonth: thisMonthRevenue._sum.totalAmount ?? 0,
        lastMonth: lastMonthRevenue._sum.totalAmount ?? 0,
      },
      orders: {
        total:     totalOrders,
        delivered: deliveredOrders,
        pending:   pendingOrders,
        cancelled: cancelledOrders,
      },
      products: {
        total:      totalProducts,
        lowStock:   lowStockCount,
        outOfStock: outOfStockCount,
      },
      topProducts,
      monthlyTrend,
      pnl: {
        month:    monthParam ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
        revenue:  plRevenueVal,
        expenses: plExpenseVal,
        profit:   plProfit,
        margin:   plMargin,
      },
    }))

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 })
  }
}
