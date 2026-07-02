import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UpdateSupplierSchema } from "@/lib/validators"
import { requireBranchContext, isBranchContext } from "@/lib/branch-auth"
import { can, type Role } from "@/lib/permissions"

// PATCH /api/suppliers/[id] — OWNER and MANAGER only
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireBranchContext(request)
    if (!isBranchContext(ctx)) return ctx

    if (!can(ctx.session.user.role as Role, "supplier:update")) {
      return NextResponse.json({ error: "You do not have permission to edit suppliers" }, { status: 403 })
    }

    const { id }   = await params
    const parsed   = UpdateSupplierSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const existing = await prisma.supplier.findFirst({
      where: { id, businessId: ctx.session.user.businessId },
    })
    if (!existing) return NextResponse.json({ error: "Supplier not found" }, { status: 404 })

    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        name:    parsed.data.name    ?? existing.name,
        email:   parsed.data.email   ?? existing.email,
        phone:   parsed.data.phone   ?? existing.phone,
        country: parsed.data.country ?? existing.country,
      },
      include: { _count: { select: { products: true } } },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to update supplier" }, { status: 500 })
  }
}

// DELETE /api/suppliers/[id] — OWNER only
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireBranchContext(request)
    if (!isBranchContext(ctx)) return ctx

    if (!can(ctx.session.user.role as Role, "supplier:delete")) {
      return NextResponse.json({ error: "Only the account owner can delete suppliers" }, { status: 403 })
    }

    const { id }   = await params
    const existing = await prisma.supplier.findFirst({
      where: { id, businessId: ctx.session.user.businessId },
    })
    if (!existing) return NextResponse.json({ error: "Supplier not found" }, { status: 404 })

    // Unlink products first — do not cascade-delete them
    await prisma.product.updateMany({
      where: { supplierId: id },
      data:  { supplierId: null },
    })
    await prisma.supplier.delete({ where: { id } })

    return NextResponse.json({ message: "Supplier deleted" })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to delete supplier" }, { status: 500 })
  }
}
