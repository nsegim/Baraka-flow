import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const businessId = session.user.businessId

    // Run all queries in parallel for speed
    // Promise.all means: start all queries at the same time
    // don't wait for one to finish before starting the next
    const [
      totalProducts,
      lowStockProducts,
      outOfStockProducts,
      todayOrders,
      allOrders,
      recentOrders,
    ] = await Promise.all([

      // 1. Total products
      prisma.product.count({
        where: { businessId }
      }),

      // 2. Low stock products
      prisma.product.findMany({
        where: {
          businessId,
          stock: { gt: 0 },           // gt = greater than
          // stock is less than or equal to minStock
          // Prisma doesn't support field comparison directly
          // so we fetch all and filter — we'll handle this below
        },
        select: {
          id:       true,
          name:     true,
          stock:    true,
          minStock: true,
          category: { select: { name: true } }
        }
      }),

      // 3. Out of stock
      prisma.product.count({
        where: {
          businessId,
          stock: 0
        }
      }),

      // 4. Orders created today
      prisma.order.count({
        where: {
          businessId,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
            // gte = greater than or equal
            // setHours(0,0,0,0) = midnight today
            // So: orders created from midnight until now
          }
        }
      }),

      // 5. All delivered orders for revenue
      prisma.order.findMany({
        where: {
          businessId,
          status: "DELIVERED"
        },
        select: { totalAmount: true }
      }),

      // 6. Recent 5 orders
      prisma.order.findMany({
        where:   { businessId },
        include: {
          items: {
            include: { product: true },
            take: 1  // just first item for preview
          }
        },
        orderBy: { createdAt: "desc" },
        take: 5
      }),

    ])

    // Filter low stock after fetching
    // (products where stock <= minStock)
    const lowStock = lowStockProducts.filter(
      p => p.stock <= p.minStock
    )

    // Calculate total revenue from delivered orders
    const totalRevenue = allOrders.reduce(
      (sum, order) => sum + order.totalAmount,
      0
    )

    // Calculate revenue this month only
    const thisMonth = new Date()
    thisMonth.setDate(1)  // first day of current month
    thisMonth.setHours(0, 0, 0, 0)

    const monthlyRevenue = await prisma.order.aggregate({
      where: {
        businessId,
        status:    "DELIVERED",
        createdAt: { gte: thisMonth }
      },
      _sum: { totalAmount: true }
    })

    return NextResponse.json({
      stats: {
        totalProducts,
        lowStockCount:  lowStock.length,
        outOfStock:     outOfStockProducts,
        todayOrders,
        totalRevenue,
        monthlyRevenue: monthlyRevenue._sum.totalAmount || 0,
      },
      lowStockItems: lowStock.slice(0, 4),
      recentOrders:  recentOrders,
    })

  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    )
  }
}