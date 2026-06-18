import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UpdateOrderStatusSchema } from "@/lib/validators"
import { serialize } from "@/lib/serialize"
import { createNotification } from "@/lib/notify"

const ORDER_INCLUDE = {
  items:    { include: { product: true } },
  user:     { select: { name: true } },
  payments: { orderBy: { paidAt: "desc" as const } },
}

// GET /api/orders/[id] — fetch single order with payments
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const order = await prisma.order.findFirst({
      where:   { id, businessId: session.user.businessId },
      include: ORDER_INCLUDE,
    })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

    return NextResponse.json(serialize(order))
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 })
  }
}

// PATCH /api/orders/[id] — OWNER and MANAGER only
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["OWNER", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "You do not have permission to update orders" },
        { status: 403 }
      )
    }

    const { id } = await params
    const body   = await request.json()

    const parsed = UpdateOrderStatusSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { status, deliveryNotes } = parsed.data

    const existing = await prisma.order.findFirst({
      where:   { id, businessId: session.user.businessId },
      include: { items: true },
    })

    if (!existing) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    // Deduct stock when marking as DELIVERED (only once — guard against re-delivery)
    if (status === "DELIVERED" && existing.status !== "DELIVERED") {
      await prisma.$transaction(async (tx) => {
        for (const item of existing.items) {
          await tx.product.update({
            where: { id: item.productId },
            data:  { stock: { decrement: item.quantity } },
          })
          await tx.stockMovement.create({
            data: {
              type:      "SALE",
              quantity:  -item.quantity,
              reason:    `Order ${existing.orderNumber} delivered`,
              productId: item.productId,
              userId:    session.user.id,
            },
          })
        }
        await tx.order.update({ where: { id }, data: { status } })
      })

      // Store delivery timestamp and notes — raw SQL, gracefully no-ops pre-migration
      await prisma.$executeRaw`
        UPDATE "Order"
        SET "deliveredAt"   = NOW(),
            "deliveryNotes" = ${deliveryNotes ?? null},
            "updatedAt"     = NOW()
        WHERE id = ${id}
      `.catch(() => {})

    } else {
      await prisma.order.update({ where: { id }, data: { status } })
    }

    // Notifications — fire-and-forget
    if (status === "DELIVERED") {
      createNotification(
        session.user.businessId,
        "ORDER_DELIVERED",
        `Order Delivered — ${existing.orderNumber}`,
        `${existing.customerName}'s order has been marked as delivered`,
        "/orders",
      )
      // Check for any products that dropped below minStock after stock deduction
      const lowStock = await prisma.product.findMany({
        where: {
          businessId: session.user.businessId,
          id: { in: existing.items.map(i => i.productId) },
        },
        select: { name: true, stock: true, minStock: true },
      })
      const flagged = lowStock.filter(p => p.stock <= p.minStock)
      if (flagged.length > 0) {
        createNotification(
          session.user.businessId,
          "LOW_STOCK",
          `Low Stock Alert — ${flagged.length} product${flagged.length > 1 ? "s" : ""}`,
          flagged.map(p => `${p.name} (${p.stock} left)`).join(", "),
          "/stock-alerts",
        )
      }
    } else if (status === "CANCELLED") {
      createNotification(
        session.user.businessId,
        "ORDER_CANCELLED",
        `Order Cancelled — ${existing.orderNumber}`,
        `${existing.customerName}'s order was cancelled`,
        "/orders",
      )
    }

    const updated = await prisma.order.findFirst({
      where:   { id },
      include: ORDER_INCLUDE,
    })

    return NextResponse.json(serialize(updated))

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 })
  }
}

// DELETE /api/orders/[id] — OWNER only
// If the order was already DELIVERED, restores stock before deleting.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "OWNER") {
      return NextResponse.json(
        { error: "Only the account owner can delete orders" },
        { status: 403 }
      )
    }

    const { id } = await params

    const existing = await prisma.order.findFirst({
      where:   { id, businessId: session.user.businessId },
      include: { items: true },
    })

    if (!existing) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      // Restore stock if the order was already delivered
      if (existing.status === "DELIVERED") {
        for (const item of existing.items) {
          await tx.product.update({
            where: { id: item.productId },
            data:  { stock: { increment: item.quantity } },
          })

          await tx.stockMovement.create({
            data: {
              type:      "RETURN",
              quantity:  item.quantity,
              reason:    `Order ${existing.orderNumber} deleted — stock restored`,
              productId: item.productId,
              // userId added after schema migration (Task 15)
            },
          })
        }
      }

      await tx.orderItem.deleteMany({ where: { orderId: id } })
      await tx.order.delete({ where: { id } })
    })

    return NextResponse.json({ message: "Order deleted" })

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to delete order" }, { status: 500 })
  }
}
