import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { can, type Role } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { UpdatePurchaseOrderStatusSchema } from "@/lib/validators"
import { serialize } from "@/lib/serialize"

// GET /api/purchase-orders/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params

    const po = await prisma.purchaseOrder.findFirst({
      where:   { id, businessId: session.user.businessId },
      include: {
        supplier:  { select: { id: true, name: true, phone: true, email: true } },
        createdBy: { select: { id: true, name: true } },
        items:     {
          include: { product: { select: { id: true, name: true, unit: true } } },
        },
      },
    })

    if (!po) return NextResponse.json({ error: "Purchase order not found" }, { status: 404 })

    return NextResponse.json(serialize(po))

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to fetch purchase order" }, { status: 500 })
  }
}

// PATCH /api/purchase-orders/[id] — update status only
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!can(session.user.role as Role, "purchase-order:update")) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const { id } = await params
    const body   = await request.json()

    const parsed = UpdatePurchaseOrderStatusSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const existing = await prisma.purchaseOrder.findFirst({
      where: { id, businessId: session.user.businessId },
    })
    if (!existing) return NextResponse.json({ error: "Purchase order not found" }, { status: 404 })

    if (existing.status === "RECEIVED" || existing.status === "CANCELLED") {
      return NextResponse.json({ error: `Cannot update a ${existing.status.toLowerCase()} purchase order` }, { status: 400 })
    }

    const updated = await prisma.purchaseOrder.update({
      where:   { id },
      data:    { status: parsed.data.status },
      include: {
        supplier:  { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        items:     {
          include: { product: { select: { id: true, name: true, unit: true } } },
        },
      },
    })

    return NextResponse.json(serialize(updated))

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to update purchase order" }, { status: 500 })
  }
}

// DELETE /api/purchase-orders/[id] — OWNER only, DRAFT/CANCELLED only
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!can(session.user.role as Role, "purchase-order:update")) {
      return NextResponse.json({ error: "Only the account owner can delete purchase orders" }, { status: 403 })
    }

    const { id } = await params

    const existing = await prisma.purchaseOrder.findFirst({
      where: { id, businessId: session.user.businessId },
    })
    if (!existing) return NextResponse.json({ error: "Purchase order not found" }, { status: 404 })

    if (!["DRAFT", "CANCELLED"].includes(existing.status)) {
      return NextResponse.json({ error: "Only draft or cancelled orders can be deleted" }, { status: 400 })
    }

    await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } })
    await prisma.purchaseOrder.delete({ where: { id } })

    return NextResponse.json({ message: "Purchase order deleted" })

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to delete purchase order" }, { status: 500 })
  }
}
