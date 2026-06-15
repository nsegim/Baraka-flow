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

    // Date ranges
    const now           = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0)

    const [
      totalRevenue,
      thisMonthRevenue,
      lastMonthRevenue,
      totalOrders,
      deliveredOrders,
      pendingOrders,
      cancelledOrders,
      totalProducts,
      allProducts,
      topProductsRaw,
    ] = await Promise.all([

      // Total revenue
      prisma.order.aggregate({
        where: { businessId, status: "DELIVERED" },
        _sum:  { totalAmount: true }
      }),

      // This month revenue
      prisma.order.aggregate({
        where: {
          businessId,
          status:    "DELIVERED",
          createdAt: { gte: thisMonthStart }
        },
        _sum: { totalAmount: true }
      }),

      // Last month revenue
      prisma.order.aggregate({
        where: {
          businessId,
          status:    "DELIVERED",
          createdAt: {
            gte: lastMonthStart,
            lte: lastMonthEnd
          }
        },
        _sum: { totalAmount: true }
      }),

      // Order counts
      prisma.order.count({ where: { businessId } }),
      prisma.order.count({ where: { businessId, status: "DELIVERED" } }),
      prisma.order.count({ where: { businessId, status: "PENDING"   } }),
      prisma.order.count({ where: { businessId, status: "CANCELLED" } }),

      // Product counts
      prisma.product.count({ where: { businessId } }),

      // All products for low stock calc
      prisma.product.findMany({
        where:  { businessId },
        select: { stock: true, minStock: true }
      }),

      // Top selling products from order items
      prisma.orderItem.groupBy({
        by:      ["productId"],
        where: {
          order: {
            businessId,
            status: "DELIVERED"
          }
        },
        _sum:    { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take:    5
      }),

    ])

    // Calculate low stock from fetched products
    const lowStockCount  = allProducts.filter(
      p => p.stock > 0 && p.stock <= p.minStock
    ).length

    const outOfStockCount = allProducts.filter(
      p => p.stock === 0
    ).length

    // Get product names and revenue for top products
    const topProducts = await Promise.all(
      topProductsRaw.map(async item => {
        const product = await prisma.product.findUnique({
          where:  { id: item.productId },
          select: { name: true, price: true }
        })

        const revenue = await prisma.orderItem.aggregate({
          where: {
            productId: item.productId,
            order: { businessId, status: "DELIVERED" }
          },
          _sum: { quantity: true }
        })

        return {
          name:      product?.name || "Unknown",
          totalSold: item._sum.quantity || 0,
          revenue:   (item._sum.quantity || 0) * (product?.price || 0),
        }
      })
    )

    return NextResponse.json({
      revenue: {
        total:     totalRevenue._sum.totalAmount      || 0,
        thisMonth: thisMonthRevenue._sum.totalAmount  || 0,
        lastMonth: lastMonthRevenue._sum.totalAmount  || 0,
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
    })

  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Failed to fetch reports" },
      { status: 500 }
    )
  }
}