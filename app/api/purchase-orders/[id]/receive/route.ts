import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { serialize } from "@/lib/serialize"
import { z } from "zod"
import { createAuditLog } from "@/lib/audit"
import { getIp } from "@/lib/rate-limit"
import { requireBranchContext, isBranchContext } from "@/lib/branch-auth"

const ReceiveSchema = z.object({
  items: z.array(z.object({
    id:               z.string().cuid(),
    quantityReceived: z.number().int().min(0),
  })).min(1),
})

// POST /api/purchase-orders/[id]/receive
// Goods receipt: increments BranchInventory for the PO's branch.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireBranchContext(request)
    if (!isBranchContext(ctx)) return ctx

    if (!["OWNER", "MANAGER"].includes(ctx.session.user.role)) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const { id } = await params

    const po = await prisma.purchaseOrder.findFirst({
      where:   { id, businessId: ctx.session.user.businessId },
      include: { items: true },
    })
    if (!po) return NextResponse.json({ error: "Purchase order not found" }, { status: 404 })
    if (!po.branchId) return NextResponse.json({ error: "Purchase order has no branch assigned" }, { status: 400 })

    const branchId = po.branchId

    // MANAGER can only receive for their assigned branch
    if (ctx.session.user.role === "MANAGER" && ctx.session.user.branchId !== branchId) {
      return NextResponse.json({ error: "You can only receive goods for your assigned branch" }, { status: 403 })
    }

    if (po.status === "CANCELLED") {
      return NextResponse.json({ error: "Cannot receive a cancelled purchase order" }, { status: 400 })
    }
    if (po.status === "RECEIVED") {
      return NextResponse.json({ error: "This purchase order has already been fully received" }, { status: 400 })
    }

    const body   = await request.json()
    const parsed = ReceiveSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const incomingMap = new Map(parsed.data.items.map(i => [i.id, i.quantityReceived]))

    for (const item of po.items) {
      const incoming   = incomingMap.get(item.id) ?? 0
      const maxAllowed = item.quantity - item.quantityReceived
      if (incoming > maxAllowed) {
        return NextResponse.json(
          { error: `Item ${item.id}: cannot receive ${incoming}, only ${maxAllowed} remaining` },
          { status: 400 }
        )
      }
    }

    const toReceive = po.items.filter(item => (incomingMap.get(item.id) ?? 0) > 0)
    if (toReceive.length === 0) {
      return NextResponse.json({ error: "No quantities entered" }, { status: 400 })
    }

    const allFullyReceived = po.items.every(item => {
      const newTotal = item.quantityReceived + (incomingMap.get(item.id) ?? 0)
      return newTotal >= item.quantity
    })
    const newStatus = allFullyReceived ? "RECEIVED" : "CONFIRMED"

    const receivedValue = toReceive.reduce((sum, item) => {
      return sum + (incomingMap.get(item.id)!) * Number(item.unitCost)
    }, 0)

    await prisma.$transaction(async (tx) => {
      await tx.purchaseOrder.update({ where: { id }, data: { status: newStatus } })

      for (const item of toReceive) {
        const qty = incomingMap.get(item.id)!
        // Add to BranchInventory for the PO's branch
        await tx.branchInventory.upsert({
          where:  { branchId_productId: { branchId, productId: item.productId } },
          update: { stock: { increment: qty } },
          create: { branchId, productId: item.productId, stock: qty, minStock: 5 },
        })
        await tx.stockMovement.create({
          data: {
            type:      "IMPORT",
            quantity:  qty,
            reason:    `Receive from PO ${po.poNumber}`,
            productId: item.productId,
            branchId,
            userId:    ctx.session.user.id,
          },
        })
        await tx.purchaseOrderItem.update({
          where: { id: item.id },
          data:  { quantityReceived: { increment: qty } },
        })
      }

      if (receivedValue > 0) {
        await tx.supplier.update({
          where: { id: po.supplierId },
          data:  { outstandingBalance: { increment: receivedValue } },
        })
      }
    })

    const updated = await prisma.purchaseOrder.findUnique({
      where:   { id },
      include: {
        supplier:  { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        branch:    { select: { name: true, code: true } },
        items: {
          include: {
            product: {
              select: {
                id: true, name: true, unit: true,
                inventory: { where: { branchId }, select: { stock: true } },
              },
            },
          },
        },
      },
    })

    createAuditLog({
      businessId: ctx.session.user.businessId,
      branchId,
      userId:     ctx.session.user.id,
      action:     "GOODS_RECEIVED",
      entityType: "PurchaseOrder",
      entityId:   id,
      metadata:   { poNumber: po.poNumber, itemsReceived: toReceive.length, receivedValue, newStatus },
      ipAddress:  getIp(request),
    })

    return NextResponse.json(serialize(updated))
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to receive purchase order" }, { status: 500 })
  }
}
