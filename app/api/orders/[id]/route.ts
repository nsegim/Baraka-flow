import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// PATCH — update order status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { id }     = await params
    const { status } = await request.json()

    // Security check
    const existing = await prisma.order.findFirst({
      where: { id, businessId: session.user.businessId },
      include: { items: true }
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      )
    }

    // When status changes to DELIVERED
    // automatically reduce stock for each item
    // This is the most powerful feature — automatic stock deduction
    if (status === "DELIVERED" && existing.status !== "DELIVERED") {
      await prisma.$transaction(async (tx) => {

        // Update each product's stock
        for (const item of existing.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: { decrement: item.quantity }
              // decrement means: stock = stock - quantity
              // Prisma handles this safely — no race conditions
            }
          })

          // Log the stock movement
          await tx.stockMovement.create({
            data: {
              type:      "SALE",
              quantity:  -item.quantity,
              reason:    `Order ${existing.orderNumber} delivered`,
              productId: item.productId,
            }
          })
        }

        // Update order status
        await tx.order.update({
          where: { id },
          data:  { status }
        })
      })

    } else {
      // For other status changes — just update status
      await prisma.order.update({
        where: { id },
        data:  { status }
      })
    }

    // Fetch and return updated order
    const updated = await prisma.order.findFirst({
      where:   { id },
      include: {
        items: { include: { product: true } },
        user:  { select: { name: true } }
      }
    })

    return NextResponse.json(updated)

  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Failed to update order" },
      { status: 500 }
    )
  }
}

// DELETE — cancel and delete order
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { id } = await params

    const existing = await prisma.order.findFirst({
      where: { id, businessId: session.user.businessId }
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      )
    }

    // Delete items first (foreign key)
    await prisma.orderItem.deleteMany({
      where: { orderId: id }
    })

    await prisma.order.delete({
      where: { id }
    })

    return NextResponse.json({ message: "Order deleted" })

  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Failed to delete order" },
      { status: 500 }
    )
  }
}