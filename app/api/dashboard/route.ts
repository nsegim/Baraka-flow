import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { serialize } from "@/lib/serialize"
import { requireBranchContext, isBranchContext, buildBranchWhere } from "@/lib/branch-auth"

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireBranchContext(request)
    if (!isBranchContext(ctx)) return ctx

    const businessId = ctx.session.user.businessId
    const branchId   = ctx.branchId   // null = all branches (Owner consolidated view)
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0))
    const thisMonth  = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const orderWhere = buildBranchWhere(ctx)

    type SumRow    = { total: string | null }
    type CountRow  = { count: string }

    // ── Product & stock counts via BranchInventory ────────────────────────────
    // Run two separate queries depending on branch context to avoid $raw
    let totalProducts = 0
    let outOfStock    = 0
    let lowStockCount = 0

    if (branchId) {
      const [totalRow] = await prisma.$queryRaw<{ cnt: string }[]>`
        SELECT COUNT(DISTINCT p.id)::text AS cnt
        FROM "Product" p
        JOIN "BranchInventory" bi ON bi."productId" = p.id
        WHERE p."businessId" = ${businessId} AND bi."branchId" = ${branchId}
      `.catch(() => [{ cnt: "0" }])
      const [outRow] = await prisma.$queryRaw<{ cnt: string }[]>`
        SELECT COUNT(*)::text AS cnt FROM "BranchInventory"
        WHERE "branchId" = ${branchId} AND stock = 0
      `.catch(() => [{ cnt: "0" }])
      const [lowRow] = await prisma.$queryRaw<{ cnt: string }[]>`
        SELECT COUNT(*)::text AS cnt FROM "BranchInventory"
        WHERE "branchId" = ${branchId} AND stock > 0 AND stock <= "minStock"
      `.catch(() => [{ cnt: "0" }])
      totalProducts = Number(totalRow?.cnt ?? 0)
      outOfStock    = Number(outRow?.cnt   ?? 0)
      lowStockCount = Number(lowRow?.cnt   ?? 0)
    } else {
      const [totalRow] = await prisma.$queryRaw<{ cnt: string }[]>`
        SELECT COUNT(DISTINCT id)::text AS cnt FROM "Product" WHERE "businessId" = ${businessId}
      `.catch(() => [{ cnt: "0" }])
      const [outRow] = await prisma.$queryRaw<{ cnt: string }[]>`
        SELECT COUNT(*)::text AS cnt FROM "BranchInventory" bi
        JOIN "Product" p ON p.id = bi."productId"
        WHERE p."businessId" = ${businessId} AND bi.stock = 0
      `.catch(() => [{ cnt: "0" }])
      const [lowRow] = await prisma.$queryRaw<{ cnt: string }[]>`
        SELECT COUNT(*)::text AS cnt FROM "BranchInventory" bi
        JOIN "Product" p ON p.id = bi."productId"
        WHERE p."businessId" = ${businessId} AND bi.stock > 0 AND bi.stock <= bi."minStock"
      `.catch(() => [{ cnt: "0" }])
      totalProducts = Number(totalRow?.cnt ?? 0)
      outOfStock    = Number(outRow?.cnt   ?? 0)
      lowStockCount = Number(lowRow?.cnt   ?? 0)
    }

    // ── Orders ────────────────────────────────────────────────────────────────
    const [todayOrders, totalRevenue, monthlyRevenue, recentOrders] = await Promise.all([
      prisma.order.count({ where: { ...orderWhere, createdAt: { gte: todayStart } } }),
      prisma.order.aggregate({ where: { ...orderWhere, status: "DELIVERED" },
        _sum: { totalAmount: true } }),
      prisma.order.aggregate({ where: { ...orderWhere, status: "DELIVERED", createdAt: { gte: thisMonth } },
        _sum: { totalAmount: true } }),
      prisma.order.findMany({
        where:   orderWhere,
        include: {
          items:  { include: { product: true }, take: 1 },
          branch: { select: { name: true, code: true } },
        },
        orderBy: { createdAt: "desc" },
        take:    5,
      }),
    ])

    // ── AR: customer outstanding ──────────────────────────────────────────────
    let arOutstanding = 0
    if (branchId) {
      const [arRow] = await prisma.$queryRaw<SumRow[]>`
        SELECT COALESCE(SUM("outstandingBalance"), 0)::text AS total
        FROM "Customer"
        WHERE "businessId" = ${businessId}
          AND ("branchId" = ${branchId} OR "branchId" IS NULL)
          AND "outstandingBalance" > 0
      `.catch(() => [{ total: "0" }])
      arOutstanding = Number(arRow?.total ?? 0)
    } else {
      const [arRow] = await prisma.$queryRaw<SumRow[]>`
        SELECT COALESCE(SUM("outstandingBalance"), 0)::text AS total
        FROM "Customer" WHERE "businessId" = ${businessId} AND "outstandingBalance" > 0
      `.catch(() => [{ total: "0" }])
      arOutstanding = Number(arRow?.total ?? 0)
    }

    // ── AP: supplier outstanding (always business-wide) ───────────────────────
    const [apRow] = await prisma.$queryRaw<SumRow[]>`
      SELECT COALESCE(SUM("outstandingBalance"), 0)::text AS total
      FROM "Supplier" WHERE "businessId" = ${businessId} AND "outstandingBalance" > 0
    `.catch(() => [{ total: "0" }])
    const apOutstanding = Number(apRow?.total ?? 0)

    // ── Cash collected ────────────────────────────────────────────────────────
    let cashCollectedToday = 0
    let cashCollectedMonth = 0
    if (branchId) {
      const [ct] = await prisma.$queryRaw<SumRow[]>`
        SELECT COALESCE(SUM(p.amount), 0)::text AS total FROM "Payment" p
        JOIN "Order" o ON o.id = p."orderId"
        WHERE o."businessId" = ${businessId} AND o."branchId" = ${branchId} AND p."paidAt" >= ${todayStart}
      `.catch(() => [{ total: "0" }])
      const [cm] = await prisma.$queryRaw<SumRow[]>`
        SELECT COALESCE(SUM(p.amount), 0)::text AS total FROM "Payment" p
        JOIN "Order" o ON o.id = p."orderId"
        WHERE o."businessId" = ${businessId} AND o."branchId" = ${branchId} AND p."paidAt" >= ${thisMonth}
      `.catch(() => [{ total: "0" }])
      cashCollectedToday = Number(ct?.total ?? 0)
      cashCollectedMonth = Number(cm?.total ?? 0)
    } else {
      const [ct] = await prisma.$queryRaw<SumRow[]>`
        SELECT COALESCE(SUM(p.amount), 0)::text AS total FROM "Payment" p
        JOIN "Order" o ON o.id = p."orderId"
        WHERE o."businessId" = ${businessId} AND p."paidAt" >= ${todayStart}
      `.catch(() => [{ total: "0" }])
      const [cm] = await prisma.$queryRaw<SumRow[]>`
        SELECT COALESCE(SUM(p.amount), 0)::text AS total FROM "Payment" p
        JOIN "Order" o ON o.id = p."orderId"
        WHERE o."businessId" = ${businessId} AND p."paidAt" >= ${thisMonth}
      `.catch(() => [{ total: "0" }])
      cashCollectedToday = Number(ct?.total ?? 0)
      cashCollectedMonth = Number(cm?.total ?? 0)
    }

    // ── Overdue orders ────────────────────────────────────────────────────────
    let overdueOrders = 0
    if (branchId) {
      const [od] = await prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(*)::text AS count FROM "Order"
        WHERE "businessId" = ${businessId} AND "branchId" = ${branchId}
          AND status = 'DELIVERED' AND "paymentStatus" != 'PAID'
          AND "dueDate" IS NOT NULL AND "dueDate" < NOW()
      `.catch(() => [{ count: "0" }])
      overdueOrders = Number(od?.count ?? 0)
    } else {
      const [od] = await prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(*)::text AS count FROM "Order"
        WHERE "businessId" = ${businessId}
          AND status = 'DELIVERED' AND "paymentStatus" != 'PAID'
          AND "dueDate" IS NOT NULL AND "dueDate" < NOW()
      `.catch(() => [{ count: "0" }])
      overdueOrders = Number(od?.count ?? 0)
    }

    // ── Low-stock items ───────────────────────────────────────────────────────
    type LowStockRow = {
      id: string; name: string; stock: number; minStock: number
      categoryName: string | null; branchName: string | null; branchCode: string | null
    }
    let lowStockItems: LowStockRow[] = []
    if (branchId) {
      lowStockItems = await prisma.$queryRaw<LowStockRow[]>`
        SELECT p.id, p.name, bi.stock::int AS stock, bi."minStock"::int AS "minStock",
               c.name AS "categoryName", b.name AS "branchName", b.code AS "branchCode"
        FROM "BranchInventory" bi
        JOIN "Product" p ON p.id = bi."productId"
        LEFT JOIN "Category" c ON c.id = p."categoryId"
        JOIN "Branch" b ON b.id = bi."branchId"
        WHERE p."businessId" = ${businessId} AND bi."branchId" = ${branchId}
          AND bi.stock <= bi."minStock"
        ORDER BY bi.stock ASC, p.name ASC LIMIT 4
      `.catch(() => [])
    } else {
      lowStockItems = await prisma.$queryRaw<LowStockRow[]>`
        SELECT p.id, p.name, bi.stock::int AS stock, bi."minStock"::int AS "minStock",
               c.name AS "categoryName", b.name AS "branchName", b.code AS "branchCode"
        FROM "BranchInventory" bi
        JOIN "Product" p ON p.id = bi."productId"
        LEFT JOIN "Category" c ON c.id = p."categoryId"
        JOIN "Branch" b ON b.id = bi."branchId"
        WHERE p."businessId" = ${businessId} AND bi.stock <= bi."minStock"
        ORDER BY bi.stock ASC, p.name ASC LIMIT 4
      `.catch(() => [])
    }

    // ── Branch comparison (Owner all-branches view only) ──────────────────────
    type BranchRow = {
      branchId: string; branchName: string; branchCode: string
      revenue: string | null; expenses: string | null; orderCount: string
    }
    let branchComparison: BranchRow[] = []
    if (ctx.isOwner && !branchId) {
      branchComparison = await prisma.$queryRaw<BranchRow[]>`
        SELECT
          br.id                                                          AS "branchId",
          br.name                                                        AS "branchName",
          br.code                                                        AS "branchCode",
          SUM(o."totalAmount") FILTER (WHERE o.status = 'DELIVERED')::text AS revenue,
          SUM(e.amount)::text                                            AS expenses,
          COUNT(DISTINCT o.id)::text                                     AS "orderCount"
        FROM "Branch" br
        LEFT JOIN "Order"   o ON o."branchId" = br.id
        LEFT JOIN "Expense" e ON e."branchId" = br.id
        WHERE br."businessId" = ${businessId} AND br."isActive" = true
        GROUP BY br.id, br.name, br.code
        ORDER BY revenue DESC NULLS LAST
      `.catch(() => [])
    }

    return NextResponse.json(serialize({
      stats: {
        totalProducts,
        lowStockCount,
        outOfStock,
        todayOrders,
        totalRevenue:        totalRevenue._sum.totalAmount   ?? 0,
        monthlyRevenue:      monthlyRevenue._sum.totalAmount ?? 0,
        arOutstanding,
        apOutstanding,
        cashCollectedToday,
        cashCollectedMonth,
        overdueOrders,
      },
      lowStockItems,
      recentOrders,
      branchComparison,
      branchContext: {
        isOwner:    ctx.isOwner,
        branchId:   branchId ?? null,
        viewingAll: ctx.isOwner && !branchId,
      },
    }))
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 })
  }
}
