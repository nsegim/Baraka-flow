import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET — fetch all orders
export async function GET() {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const orders = await prisma.order.findMany({
      where:   { businessId: session.user.businessId },
      include: {
        items: {
          include: { product: true }
        },
        user: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: "desc" }
    })

    return NextResponse.json(orders)

  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    )
  }
}

// POST — create new order
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { customerName, customerPhone, notes, items } = body

    // Validate
    if (!customerName?.trim()) {
      return NextResponse.json(
        { error: "Customer name is required" },
        { status: 400 }
      )
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: "Order must have at least one item" },
        { status: 400 }
      )
    }

    // Generate order number automatically
    // Count existing orders for this business + 1
    const orderCount = await prisma.order.count({
      where: { businessId: session.user.businessId }
    })

    const orderNumber = `ORD-${new Date().getFullYear()}-${String(orderCount + 1).padStart(3, "0")}`
    // Example: ORD-2025-001, ORD-2025-002, ORD-2025-023

    // Calculate total from items
    const totalAmount = items.reduce(
      (sum: number, item: { unitPrice: number; quantity: number }) =>
        sum + item.unitPrice * item.quantity,
      0
    )

    // Create order + items in one transaction
    const order = await prisma.$transaction(async (tx) => {

      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          customerName:  customerName.trim(),
          customerPhone: customerPhone || null,
          notes:         notes         || null,
          totalAmount,
          status:        "PENDING",
          businessId:    session.user.businessId,
          userId:        session.user.id,
          items: {
            create: items.map((item: {
              productId: string
              quantity:  number
              unitPrice: number
            }) => ({
              productId: item.productId,
              quantity:  item.quantity,
              unitPrice: item.unitPrice,
            }))
          }
        },
        include: {
          items: {
            include: { product: true }
          },
          user: {
            select: { name: true }
          }
        }
      })

      return newOrder
    })

    return NextResponse.json(order, { status: 201 })

  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    )
  }
}