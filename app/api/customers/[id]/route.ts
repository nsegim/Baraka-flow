import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UpdateCustomerSchema } from "@/lib/validators"
import { serialize } from "@/lib/serialize"
import { requireBranchContext, isBranchContext } from "@/lib/branch-auth"
import { can, type Role } from "@/lib/permissions"

// GET /api/customers/[id] — all roles
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireBranchContext(request)
    if (!isBranchContext(ctx)) return ctx

    const { id }   = await params
    const customer = await prisma.customer.findFirst({
      where:   { id, businessId: ctx.session.user.businessId },
      include: {
        orders: {
          orderBy: { createdAt: "desc" },
          take:    10,
          select:  {
            id: true, orderNumber: true, totalAmount: true,
            amountPaid: true, paymentStatus: true, status: true, createdAt: true,
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
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireBranchContext(request)
    if (!isBranchContext(ctx)) return ctx

    if (!can(ctx.session.user.role as Role, "customer:update")) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const { id }   = await params
    const parsed   = UpdateCustomerSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const existing = await prisma.customer.findFirst({
      where: { id, businessId: ctx.session.user.businessId },
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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireBranchContext(request)
    if (!isBranchContext(ctx)) return ctx

    if (!can(ctx.session.user.role as Role, "customer:delete")) {
      return NextResponse.json({ error: "Only the account owner can delete customers" }, { status: 403 })
    }

    const { id }   = await params
    const existing = await prisma.customer.findFirst({
      where: { id, businessId: ctx.session.user.businessId },
    })
    if (!existing) return NextResponse.json({ error: "Customer not found" }, { status: 404 })

    // Unlink orders — do not cascade-delete them
    await prisma.order.updateMany({ where: { customerId: id }, data: { customerId: null } })
    await prisma.customer.delete({ where: { id } })

    return NextResponse.json({ message: "Customer deleted" })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to delete customer" }, { status: 500 })
  }
}
