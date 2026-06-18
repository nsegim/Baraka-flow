import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UpdateCustomerSchema } from "@/lib/validators"
import { serialize } from "@/lib/serialize"

// GET /api/customers/[id] — fetch one customer + their orders
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params

    const customer = await prisma.customer.findFirst({
      where: { id, businessId: session.user.businessId },
      include: {
        orders: {
          orderBy: { createdAt: "desc" },
          take:    10,
          select:  {
            id:            true,
            orderNumber:   true,
            totalAmount:   true,
            amountPaid:    true,
            paymentStatus: true,
            status:        true,
            createdAt:     true,
          },
        },
        _count: { select: { orders: true } },
      },
    })

    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 })

    return NextResponse.json(serialize(customer))

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to fetch customer" }, { status: 500 })
  }
}

// PATCH /api/customers/[id] — OWNER and MANAGER
export async function PATCH(
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
    const body   = await request.json()

    const parsed = UpdateCustomerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const existing = await prisma.customer.findFirst({
      where: { id, businessId: session.user.businessId },
    })
    if (!existing) return NextResponse.json({ error: "Customer not found" }, { status: 404 })

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        name:    parsed.data.name    ?? existing.name,
        phone:   parsed.data.phone   ?? existing.phone,
        email:   parsed.data.email   ?? existing.email,
        address: parsed.data.address ?? existing.address,
        notes:   parsed.data.notes   ?? existing.notes,
      },
      include: { _count: { select: { orders: true } } },
    })

    return NextResponse.json(serialize(updated))

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to update customer" }, { status: 500 })
  }
}

// DELETE /api/customers/[id] — OWNER only
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Only the account owner can delete customers" }, { status: 403 })
    }

    const { id } = await params

    const existing = await prisma.customer.findFirst({
      where: { id, businessId: session.user.businessId },
      include: { _count: { select: { orders: true } } },
    })
    if (!existing) return NextResponse.json({ error: "Customer not found" }, { status: 404 })

    // Unlink orders from this customer — do not delete orders
    await prisma.order.updateMany({
      where:  { customerId: id },
      data:   { customerId: null },
    })

    await prisma.customer.delete({ where: { id } })

    return NextResponse.json({ message: "Customer deleted" })

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to delete customer" }, { status: 500 })
  }
}
