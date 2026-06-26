import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UpdateOrderStatusSchema } from "@/lib/validators"
import { serialize } from "@/lib/serialize"
import { createNotification } from "@/lib/notify"
import { createAuditLog } from "@/lib/audit"
import { getIp } from "@/lib/rate-limit"
import { requireBranchContext, isBranchContext, buildBranchWhere } from "@/lib/branch-auth"

const ORDER_INCLUDE = {
  items:    { include: { product: true } },
  user:     { select: { name: true } },
  payments: { orderBy: { paidAt: "desc" as const } },
  branch:   { select: { name: true, code: true } },
}

// GET /api/orders/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireBranchContext(request)
    if (!isBranchContext(ctx)) return ctx

    const { id } = await params
    const order = await prisma.order.findFirst({
      where:   { id, ...buildBranchWhere(ctx) },
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
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireBranchContext(request)
    if (!isBranchContext(ctx)) return ctx

    if (!["OWNER", "MANAGER"].includes(ctx.session.user.role)) {
      return NextResponse.json({ error: "You do not have permission to update orders" }, { status: 403 })
    }

    const { id } = await params
    const body   = await request.json()
    const parsed = UpdateOrderStatusSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { status, deliveryNotes } = parsed.data

    const existing = await prisma.order.findFirst({
      where:   { id, ...buildBranchWhere(ctx) },
      include: { items: true },
    })
    if (!existing) return NextResponse.json({ error: "Order not found" }, { status: 404 })
    if (!existing.branchId) return NextResponse.json({ error: "Order has no branch assigned" }, { status: 400 })

    const branchId = existing.branchId

    // Deduct branch stock when marking DELIVERED (guard against re-delivery)
    if (status === "DELIVERED" && existing.status !== "DELIVERED") {
      await prisma.$transaction(async (tx) => {
        for (const item of existing.items) {
          await tx.branchInventory.upsert({
            where:  { branchId_productId: { branchId, productId: item.productId } },
            update: { stock: { decrement: item.quantity } },
            create: { branchId, productId: item.productId, stock: 0 },
          })
          await tx.stockMovement.create({
            data: {
              type:      "SALE",
              quantity:  -item.quantity,
              reason:    `Order ${existing.orderNumber} delivered`,
              productId: item.productId,
              branchId,
              userId:    ctx.session.user.id,
            },
          })
        }
        await tx.order.update({ where: { id }, data: { status } })

        if (existing.customerId) {
          const unpaid = Number(existing.totalAmount) - Number(existing.amountPaid)
          if (unpaid > 0) {
            await tx.customer.update({
              where: { id: existing.customerId },
              data:  { outstandingBalance: { increment: unpaid } },
            })
          }
        }
      })

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

    if (status === "DELIVERED") {
      createNotification(
        ctx.session.user.businessId,
        "ORDER_DELIVERED",
        `Order Delivered — ${existing.orderNumber}`,
        `${existing.customerName}'s order has been marked as delivered`,
        "/orders",
        branchId,
      )
      // Check for items that dropped below minStock after deduction
      const inventories = await prisma.branchInventory.findMany({
        where: {
          branchId,
          productId: { in: existing.items.map(i => i.productId) },
        },
        include: { product: { select: { name: true } } },
      })
      const flagged = inventories.filter(inv => inv.stock <= inv.minStock)
      if (flagged.length > 0) {
        createNotification(
          ctx.session.user.businessId,
          "LOW_STOCK",
          `Low Stock Alert — ${flagged.length} product${flagged.length > 1 ? "s" : ""}`,
          flagged.map(inv => inv.product.name + ` (${inv.stock} left)`).join(", "),
          "/stock-alerts",
          branchId,
        )
      }
    } else if (status === "CANCELLED") {
      createNotification(
        ctx.session.user.businessId,
        "ORDER_CANCELLED",
        `Order Cancelled — ${existing.orderNumber}`,
        `${existing.customerName}'s order was cancelled`,
        "/orders",
        branchId,
      )
    }

    const updated = await prisma.order.findFirst({
      where:   { id },
      include: ORDER_INCLUDE,
    })

    createAuditLog({
      businessId: ctx.session.user.businessId,
      branchId:   existing.branchId,
      userId:     ctx.session.user.id,
      action:     "ORDER_STATUS_CHANGED",
      entityType: "Order",
      entityId:   id,
      metadata:   { orderNumber: existing.orderNumber, from: existing.status, to: status },
      ipAddress:  getIp(request),
    })

    return NextResponse.json(serialize(updated))
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 })
  }
}

// DELETE /api/orders/[id] — OWNER only
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireBranchContext(request)
    if (!isBranchContext(ctx)) return ctx

    if (ctx.session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Only the account owner can delete orders" }, { status: 403 })
    }

    const { id } = await params
    const existing = await prisma.order.findFirst({
      where:   { id, businessId: ctx.session.user.businessId },
      include: { items: true },
    })
    if (!existing) return NextResponse.json({ error: "Order not found" }, { status: 404 })
    if (!existing.branchId) return NextResponse.json({ error: "Order has no branch assigned" }, { status: 400 })

    const branchId = existing.branchId

    await prisma.$transaction(async (tx) => {
      if (existing.status === "DELIVERED") {
        for (const item of existing.items) {
          await tx.branchInventory.upsert({
            where:  { branchId_productId: { branchId, productId: item.productId } },
            update: { stock: { increment: item.quantity } },
            create: { branchId, productId: item.productId, stock: item.quantity },
          })
          await tx.stockMovement.create({
            data: {
              type:      "RETURN",
              quantity:  item.quantity,
              reason:    `Order ${existing.orderNumber} deleted — stock restored`,
              productId: item.productId,
              branchId,
            },
          })
        }
      }
      await tx.orderItem.deleteMany({ where: { orderId: id } })
      await tx.order.delete({ where: { id } })
    })

    createAuditLog({
      businessId: ctx.session.user.businessId,
      branchId,
      userId:     ctx.session.user.id,
      action:     "ORDER_DELETED",
      entityType: "Order",
      entityId:   id,
      metadata:   { orderNumber: existing.orderNumber, customerName: existing.customerName, status: existing.status },
      ipAddress:  getIp(request),
    })

    return NextResponse.json({ message: "Order deleted" })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to delete order" }, { status: 500 })
  }
}
