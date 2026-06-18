import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { serialize } from "@/lib/serialize"

export async function GET() {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const businessId = session.user.businessId
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0))

    const thisMonth = new Date()
    thisMonth.setDate(1)
    thisMonth.setHours(0, 0, 0, 0)

    const [
      totalProducts,
      outOfStockProducts,
      todayOrders,
      totalRevenue,
      monthlyRevenue,
      recentOrders,
    ] = await Promise.all([
      prisma.product.count({ where: { businessId } }),

      prisma.product.count({ where: { businessId, stock: 0 } }),

      prisma.order.count({
        where: { businessId, createdAt: { gte: todayStart } },
      }),

      // Aggregate in the DB — do NOT fetch all rows and sum in JS
      prisma.order.aggregate({
        where: { businessId, status: "DELIVERED" },
        _sum:  { totalAmount: true },
      }),

      prisma.order.aggregate({
        where: { businessId, status: "DELIVERED", createdAt: { gte: thisMonth } },
        _sum:  { totalAmount: true },
      }),

      prisma.order.findMany({
        where:   { businessId },
        include: {
          items: { include: { product: true }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
        take:    5,
      }),
    ])

    // Low stock: stock > 0 AND stock <= minStock.
    // Prisma cannot compare two columns in a where clause, so use raw SQL.
    type CountRow = { count: bigint }
    const [lowStockRow] = await prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*) AS count
      FROM "Product"
      WHERE "businessId" = ${businessId}
        AND stock > 0
        AND stock <= "minStock"
    `
    const lowStockCount = Number(lowStockRow.count)

    // Fetch the actual low-stock items for the dashboard widget (max 4)
    const lowStockItems = await prisma.product.findMany({
      where: {
        businessId,
        stock: { gt: 0 },
      },
      select: {
        id:       true,
        name:     true,
        stock:    true,
        minStock: true,
        category: { select: { name: true } },
      },
      orderBy: { stock: "asc" },
      take:    20, // fetch a small set, then filter
    }).then(rows => rows.filter(p => p.stock <= p.minStock).slice(0, 4))

    return NextResponse.json(serialize({
      stats: {
        totalProducts,
        lowStockCount,
        outOfStock:     outOfStockProducts,
        todayOrders,
        totalRevenue:   totalRevenue._sum.totalAmount   ?? 0,
        monthlyRevenue: monthlyRevenue._sum.totalAmount ?? 0,
      },
      lowStockItems,
      recentOrders,
    }))

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 })
  }
}
