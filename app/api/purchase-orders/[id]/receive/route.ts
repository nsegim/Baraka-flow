import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { serialize } from "@/lib/serialize"
import { z } from "zod"

const ReceiveSchema = z.object({
  items: z.array(z.object({
    id:               z.string().cuid(),
    quantityReceived: z.number().int().min(0),
  })).min(1),
})

// POST /api/purchase-orders/[id]/receive
// Supports full or partial receiving per item.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!["OWNER", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const { id } = await params

    const po = await prisma.purchaseOrder.findFirst({
      where:   { id, businessId: session.user.businessId },
      include: { items: true },
    })
    if (!po) return NextResponse.json({ error: "Purchase order not found" }, { status: 404 })

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

    // Build a map of incoming quantities keyed by item id
    const incomingMap = new Map(parsed.data.items.map(i => [i.id, i.quantityReceived]))

    // Validate each item: quantityReceived can't exceed (ordered - already received)
    for (const item of po.items) {
      const incoming = incomingMap.get(item.id) ?? 0
      const maxAllowed = item.quantity - item.quantityReceived
      if (incoming > maxAllowed) {
        return NextResponse.json(
          { error: `Item ${item.id}: cannot receive ${incoming}, only ${maxAllowed} remaining` },
          { status: 400 }
        )
      }
    }

    // Only process items with incoming > 0
    const toReceive = po.items.filter(item => (incomingMap.get(item.id) ?? 0) > 0)

    if (toReceive.length === 0) {
      return NextResponse.json({ error: "No quantities entered" }, { status: 400 })
    }

    // After this receive, are all items fully received?
    const allFullyReceived = po.items.every(item => {
      const newTotal = item.quantityReceived + (incomingMap.get(item.id) ?? 0)
      return newTotal >= item.quantity
    })

    const newStatus = allFullyReceived ? "RECEIVED" : "CONFIRMED"

    await prisma.$transaction([
      prisma.purchaseOrder.update({
        where: { id },
        data:  { status: newStatus },
      }),
      ...toReceive.map(item => {
        const qty = incomingMap.get(item.id)!
        return prisma.product.update({
          where: { id: item.productId },
          data:  { stock: { increment: qty } },
        })
      }),
      ...toReceive.map(item => {
        const qty = incomingMap.get(item.id)!
        return prisma.stockMovement.create({
          data: {
            type:      "IMPORT",
            quantity:  qty,
            reason:    `Partial receive from PO ${po.poNumber}`,
            productId: item.productId,
            userId:    session.user.id,
          },
        })
      }),
      ...toReceive.map(item => {
        const qty = incomingMap.get(item.id)!
        return prisma.purchaseOrderItem.update({
          where: { id: item.id },
          data:  { quantityReceived: { increment: qty } },
        })
      }),
    ])

    const updated = await prisma.purchaseOrder.findUnique({
      where:   { id },
      include: {
        supplier:  { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        items:     {
          include: { product: { select: { id: true, name: true, unit: true, stock: true } } },
        },
      },
    })

    return NextResponse.json(serialize(updated))

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to receive purchase order" }, { status: 500 })
  }
}
