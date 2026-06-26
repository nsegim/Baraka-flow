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

    const monthParam = request.nextUrl.searchParams.get("month")

    const now            = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0)

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
      allInventory,
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
      prisma.order.aggregate({
        where: { businessId, status: "DELIVERED", createdAt: { gte: plStart, lte: plEnd } },
        _sum:  { totalAmount: true },
      }),
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
      prisma.branchInventory.findMany({
        where:  { branch: { businessId } },
        select: { stock: true, minStock: true },
      }),
    ])

    const lowStockCount   = allInventory.filter(bi => bi.stock > 0 && bi.stock <= bi.minStock).length
    const outOfStockCount = allInventory.filter(bi => bi.stock === 0).length

    const plRevenueVal  = Number(plRevenue._sum.totalAmount ?? 0)
    const plExpenseVal  = Number((plExpenses as { total: string | null }[])[0]?.total ?? 0)

    // ── COGS & Gross Profit (P&L period) ────────────────────────────────────
    // Sum costPrice * quantity for all delivered order items in the period
    type CogsRow = { cogs: string | null }
    const [cogsRow] = await prisma.$queryRaw<CogsRow[]>`
      SELECT COALESCE(SUM(oi."costPrice" * oi.quantity), 0)::text AS cogs
      FROM "OrderItem" oi
      JOIN "Order" o ON o.id = oi."orderId"
      WHERE o."businessId" = ${businessId}
        AND o.status = 'DELIVERED'
        AND o."createdAt" >= ${plStart} AND o."createdAt" <= ${plEnd}
        AND oi."costPrice" IS NOT NULL
    `.catch(() => [{ cogs: "0" }])
    const cogs        = Number(cogsRow?.cogs ?? 0)
    const grossProfit = plRevenueVal - cogs
    const grossMargin = plRevenueVal > 0 ? Math.round((grossProfit / plRevenueVal) * 100) : 0

    // Net profit (gross profit minus operating expenses)
    const netProfit = grossProfit - plExpenseVal
    const netMargin = plRevenueVal > 0 ? Math.round((netProfit / plRevenueVal) * 100) : 0

    // ── AR: customers with outstanding balances ──────────────────────────────
    type ArRow = { totalAr: string | null }
    const [arRow] = await prisma.$queryRaw<ArRow[]>`
      SELECT COALESCE(SUM("outstandingBalance"), 0)::text AS "totalAr"
      FROM "Customer"
      WHERE "businessId" = ${businessId}
        AND "outstandingBalance" > 0
    `.catch(() => [{ totalAr: "0" }])
    const totalAr = Number(arRow?.totalAr ?? 0)

    // AR aging buckets: current, 1-30, 31-60, 60+ days overdue
    type AgingRow = { bucket: string; count: string; amount: string }
    const arAging = await prisma.$queryRaw<AgingRow[]>`
      SELECT
        CASE
          WHEN "dueDate" IS NULL OR "dueDate" >= NOW()         THEN 'current'
          WHEN NOW() - "dueDate" <= INTERVAL '30 days'         THEN '1_30'
          WHEN NOW() - "dueDate" <= INTERVAL '60 days'         THEN '31_60'
          ELSE '60_plus'
        END AS bucket,
        COUNT(*)::text          AS count,
        COALESCE(SUM("totalAmount" - "amountPaid"), 0)::text AS amount
      FROM "Order"
      WHERE "businessId" = ${businessId}
        AND status = 'DELIVERED'
        AND "paymentStatus" != 'PAID'
        AND "customerId" IS NOT NULL
      GROUP BY bucket
    `.catch(() => [] as AgingRow[])

    const agingMap = Object.fromEntries(arAging.map(r => [r.bucket, { count: Number(r.count), amount: Number(r.amount) }]))
    const arAgingBuckets = {
      current: agingMap["current"] ?? { count: 0, amount: 0 },
      days1_30: agingMap["1_30"]   ?? { count: 0, amount: 0 },
      days31_60: agingMap["31_60"] ?? { count: 0, amount: 0 },
      days60plus: agingMap["60_plus"] ?? { count: 0, amount: 0 },
    }

    // ── AP: suppliers with outstanding balances ──────────────────────────────
    type ApRow = { totalAp: string | null }
    const [apRow] = await prisma.$queryRaw<ApRow[]>`
      SELECT COALESCE(SUM("outstandingBalance"), 0)::text AS "totalAp"
      FROM "Supplier"
      WHERE "businessId" = ${businessId}
        AND "outstandingBalance" > 0
    `.catch(() => [{ totalAp: "0" }])
    const totalAp = Number(apRow?.totalAp ?? 0)

    // Top suppliers by AP balance
    type ApSupplierRow = { name: string; outstanding: string }
    const apBySupplier = await prisma.$queryRaw<ApSupplierRow[]>`
      SELECT name, "outstandingBalance"::text AS outstanding
      FROM "Supplier"
      WHERE "businessId" = ${businessId}
        AND "outstandingBalance" > 0
      ORDER BY "outstandingBalance" DESC
      LIMIT 5
    `.catch(() => [] as ApSupplierRow[])

    // ── Cash Flow (P&L period) ───────────────────────────────────────────────
    // Cash in: payments received from customers in the period
    type CashInRow = { total: string | null }
    const [cashInRow] = await prisma.$queryRaw<CashInRow[]>`
      SELECT COALESCE(SUM(p.amount), 0)::text AS total
      FROM "Payment" p
      JOIN "Order" o ON o.id = p."orderId"
      WHERE o."businessId" = ${businessId}
        AND p."paidAt" >= ${plStart} AND p."paidAt" <= ${plEnd}
    `.catch(() => [{ total: "0" }])
    const cashIn = Number(cashInRow?.total ?? 0)

    // Cash out: supplier payments made in the period
    type CashOutRow = { total: string | null }
    const [cashOutRow] = await prisma.$queryRaw<CashOutRow[]>`
      SELECT COALESCE(SUM(amount), 0)::text AS total
      FROM "SupplierPayment"
      WHERE "businessId" = ${businessId}
        AND "paidAt" >= ${plStart} AND "paidAt" <= ${plEnd}
    `.catch(() => [{ total: "0" }])
    const cashOutSuppliers = Number(cashOutRow?.total ?? 0)

    const netCashFlow = cashIn - cashOutSuppliers - plExpenseVal

    // ── Tax collected (P&L period) ───────────────────────────────────────────
    type TaxRow = { total: string | null }
    const [taxRow] = await prisma.$queryRaw<TaxRow[]>`
      SELECT COALESCE(SUM("taxAmount"), 0)::text AS total
      FROM "Order"
      WHERE "businessId" = ${businessId}
        AND status = 'DELIVERED'
        AND "createdAt" >= ${plStart} AND "createdAt" <= ${plEnd}
    `.catch(() => [{ total: "0" }])
    const taxCollected = Number(taxRow?.total ?? 0)

    // ── Monthly trend ────────────────────────────────────────────────────────
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

    // ── Top products ─────────────────────────────────────────────────────────
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
        month:        monthParam ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
        revenue:      plRevenueVal,
        cogs,
        grossProfit,
        grossMargin,
        expenses:     plExpenseVal,
        profit:       netProfit,
        margin:       netMargin,
        taxCollected,
      },
      ar: {
        total:  totalAr,
        aging:  arAgingBuckets,
      },
      ap: {
        total:       totalAp,
        bySupplier:  apBySupplier.map(r => ({ name: r.name, outstanding: Number(r.outstanding) })),
      },
      cashFlow: {
        cashIn,
        cashOutSuppliers,
        expenses:    plExpenseVal,
        net:         netCashFlow,
      },
    }))

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 })
  }
}
