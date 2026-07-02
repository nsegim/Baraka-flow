import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { serialize } from "@/lib/serialize"
import { requireBranchContext, isBranchContext, buildBranchWhere } from "@/lib/branch-auth"
import { cache } from "@/lib/cache"

function dashKey(businessId: string, branchId: string | null) {
  return `dashboard:${businessId}:${branchId ?? "all"}`
}

// 30-second TTL — dashboard metrics tolerate slight staleness; refreshes stay fast
const DASHBOARD_TTL = 30_000

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireBranchContext(request)
    if (!isBranchContext(ctx)) return ctx

    const businessId = ctx.session.user.businessId
    const branchId   = ctx.branchId

    // Return cached snapshot if available
    const cacheKey = dashKey(businessId, branchId)
    const cached   = cache.get<object>(cacheKey)
    if (cached) return NextResponse.json(cached)

    const todayStart = new Date(new Date().setHours(0, 0, 0, 0))
    const thisMonth  = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const orderWhere = buildBranchWhere(ctx)

    type StatsRow    = { total_products: string; out_of_stock: string; low_stock: string }
    type SumRow      = { total: string | null }
    type CashRow     = { today: string | null; month: string | null }
    type CountRow    = { count: string }
    type LowStockRow = {
      id: string; name: string; stock: number; minStock: number
      categoryName: string | null; branchName: string | null; branchCode: string | null
    }
    type BranchRow = {
      branchId: string; branchName: string; branchCode: string
      revenue: string | null; expenses: string | null; orderCount: string
    }

    // ── Run all independent queries in parallel ───────────────────────────────
    const [
      inventoryStats,
      todayOrders,
      totalRevenue,
      monthlyRevenue,
      recentOrders,
      arRow,
      apRow,
      cashRow,
      overdueRow,
      lowStockItems,
      branchComparison,
    ] = await Promise.all([

      // 1. Single query for all three inventory counts
      branchId
        ? prisma.$queryRaw<StatsRow[]>`
            SELECT
              COUNT(DISTINCT p.id) FILTER (WHERE true)::text  AS total_products,
              COUNT(*) FILTER (WHERE bi.stock = 0)::text      AS out_of_stock,
              COUNT(*) FILTER (WHERE bi.stock > 0 AND bi.stock <= bi."minStock")::text AS low_stock
            FROM "BranchInventory" bi
            JOIN "Product" p ON p.id = bi."productId"
            WHERE p."businessId" = ${businessId} AND bi."branchId" = ${branchId}
          `.catch(() => [{ total_products: "0", out_of_stock: "0", low_stock: "0" }])
        : prisma.$queryRaw<StatsRow[]>`
            SELECT
              COUNT(DISTINCT p.id)::text AS total_products,
              COUNT(*) FILTER (WHERE bi.stock = 0)::text AS out_of_stock,
              COUNT(*) FILTER (WHERE bi.stock > 0 AND bi.stock <= bi."minStock")::text AS low_stock
            FROM "BranchInventory" bi
            JOIN "Product" p ON p.id = bi."productId"
            WHERE p."businessId" = ${businessId}
          `.catch(() => [{ total_products: "0", out_of_stock: "0", low_stock: "0" }]),

      // 2. Today's order count
      prisma.order.count({ where: { ...orderWhere, createdAt: { gte: todayStart } } }),

      // 3. All-time delivered revenue
      prisma.order.aggregate({
        where: { ...orderWhere, status: "DELIVERED" },
        _sum:  { totalAmount: true },
      }),

      // 4. This-month delivered revenue
      prisma.order.aggregate({
        where: { ...orderWhere, status: "DELIVERED", createdAt: { gte: thisMonth } },
        _sum:  { totalAmount: true },
      }),

      // 5. Recent orders — select only needed fields
      prisma.order.findMany({
        where:   orderWhere,
        select: {
          id: true, orderNumber: true, customerName: true, status: true,
          paymentStatus: true, totalAmount: true, createdAt: true,
          items:  { select: { product: { select: { id: true, name: true, sku: true } } }, take: 1 },
          branch: { select: { name: true, code: true } },
        },
        orderBy: { createdAt: "desc" },
        take:    5,
      }),

      // 6. AR: customer outstanding balance
      branchId
        ? prisma.$queryRaw<SumRow[]>`
            SELECT COALESCE(SUM("outstandingBalance"), 0)::text AS total
            FROM "Customer"
            WHERE "businessId" = ${businessId}
              AND ("branchId" = ${branchId} OR "branchId" IS NULL)
              AND "outstandingBalance" > 0
          `.catch(() => [{ total: "0" }])
        : prisma.$queryRaw<SumRow[]>`
            SELECT COALESCE(SUM("outstandingBalance"), 0)::text AS total
            FROM "Customer"
            WHERE "businessId" = ${businessId} AND "outstandingBalance" > 0
          `.catch(() => [{ total: "0" }]),

      // 7. AP: supplier outstanding (always business-wide)
      prisma.$queryRaw<SumRow[]>`
        SELECT COALESCE(SUM("outstandingBalance"), 0)::text AS total
        FROM "Supplier" WHERE "businessId" = ${businessId} AND "outstandingBalance" > 0
      `.catch(() => [{ total: "0" }]),

      // 8. Cash collected — today AND month in one query
      branchId
        ? prisma.$queryRaw<CashRow[]>`
            SELECT
              COALESCE(SUM(p.amount) FILTER (WHERE p."paidAt" >= ${todayStart}), 0)::text AS today,
              COALESCE(SUM(p.amount) FILTER (WHERE p."paidAt" >= ${thisMonth}),  0)::text AS month
            FROM "Payment" p
            JOIN "Order" o ON o.id = p."orderId"
            WHERE o."businessId" = ${businessId} AND o."branchId" = ${branchId}
          `.catch(() => [{ today: "0", month: "0" }])
        : prisma.$queryRaw<CashRow[]>`
            SELECT
              COALESCE(SUM(p.amount) FILTER (WHERE p."paidAt" >= ${todayStart}), 0)::text AS today,
              COALESCE(SUM(p.amount) FILTER (WHERE p."paidAt" >= ${thisMonth}),  0)::text AS month
            FROM "Payment" p
            JOIN "Order" o ON o.id = p."orderId"
            WHERE o."businessId" = ${businessId}
          `.catch(() => [{ today: "0", month: "0" }]),

      // 9. Overdue delivered orders
      branchId
        ? prisma.$queryRaw<CountRow[]>`
            SELECT COUNT(*)::text AS count FROM "Order"
            WHERE "businessId" = ${businessId} AND "branchId" = ${branchId}
              AND status = 'DELIVERED' AND "paymentStatus" != 'PAID'
              AND "dueDate" IS NOT NULL AND "dueDate" < NOW()
          `.catch(() => [{ count: "0" }])
        : prisma.$queryRaw<CountRow[]>`
            SELECT COUNT(*)::text AS count FROM "Order"
            WHERE "businessId" = ${businessId}
              AND status = 'DELIVERED' AND "paymentStatus" != 'PAID'
              AND "dueDate" IS NOT NULL AND "dueDate" < NOW()
          `.catch(() => [{ count: "0" }]),

      // 10. Low-stock items list (top 4)
      branchId
        ? prisma.$queryRaw<LowStockRow[]>`
            SELECT p.id, p.name, bi.stock::int AS stock, bi."minStock"::int AS "minStock",
                   c.name AS "categoryName", b.name AS "branchName", b.code AS "branchCode"
            FROM "BranchInventory" bi
            JOIN "Product"  p ON p.id  = bi."productId"
            LEFT JOIN "Category" c ON c.id = p."categoryId"
            JOIN "Branch"   b ON b.id  = bi."branchId"
            WHERE p."businessId" = ${businessId} AND bi."branchId" = ${branchId}
              AND bi.stock <= bi."minStock"
            ORDER BY bi.stock ASC, p.name ASC LIMIT 4
          `.catch(() => [])
        : prisma.$queryRaw<LowStockRow[]>`
            SELECT p.id, p.name, bi.stock::int AS stock, bi."minStock"::int AS "minStock",
                   c.name AS "categoryName", b.name AS "branchName", b.code AS "branchCode"
            FROM "BranchInventory" bi
            JOIN "Product"  p ON p.id  = bi."productId"
            LEFT JOIN "Category" c ON c.id = p."categoryId"
            JOIN "Branch"   b ON b.id  = bi."branchId"
            WHERE p."businessId" = ${businessId} AND bi.stock <= bi."minStock"
            ORDER BY bi.stock ASC, p.name ASC LIMIT 4
          `.catch(() => []),

      // 11. Branch comparison (Owner all-branches view only, else empty)
      ctx.isOwner && !branchId
        ? prisma.$queryRaw<BranchRow[]>`
            SELECT
              br.id   AS "branchId",
              br.name AS "branchName",
              br.code AS "branchCode",
              SUM(o."totalAmount") FILTER (WHERE o.status = 'DELIVERED')::text AS revenue,
              SUM(e.amount)::text                                                AS expenses,
              COUNT(DISTINCT o.id)::text                                         AS "orderCount"
            FROM "Branch" br
            LEFT JOIN "Order"   o ON o."branchId" = br.id
            LEFT JOIN "Expense" e ON e."branchId" = br.id
            WHERE br."businessId" = ${businessId} AND br."isActive" = true
            GROUP BY br.id, br.name, br.code
            ORDER BY revenue DESC NULLS LAST
          `.catch(() => [])
        : Promise.resolve([] as BranchRow[]),
    ])

    const inv = inventoryStats[0] ?? { total_products: "0", out_of_stock: "0", low_stock: "0" }
    const ar  = (arRow as SumRow[])[0]
    const ap  = (apRow as SumRow[])[0]
    const cash = (cashRow as CashRow[])[0]
    const od  = (overdueRow as CountRow[])[0]

    const payload = serialize({
      stats: {
        totalProducts:      Number(inv.total_products),
        lowStockCount:      Number(inv.low_stock),
        outOfStock:         Number(inv.out_of_stock),
        todayOrders,
        totalRevenue:       totalRevenue._sum.totalAmount   ?? 0,
        monthlyRevenue:     monthlyRevenue._sum.totalAmount ?? 0,
        arOutstanding:      Number(ar?.total  ?? 0),
        apOutstanding:      Number(ap?.total  ?? 0),
        cashCollectedToday: Number(cash?.today ?? 0),
        cashCollectedMonth: Number(cash?.month ?? 0),
        overdueOrders:      Number(od?.count  ?? 0),
      },
      lowStockItems,
      recentOrders,
      branchComparison,
      branchContext: {
        isOwner:    ctx.isOwner,
        branchId:   branchId ?? null,
        viewingAll: ctx.isOwner && !branchId,
      },
    })

    cache.set(cacheKey, payload, DASHBOARD_TTL)
    return NextResponse.json(payload)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 })
  }
}
