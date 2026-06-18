import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UpdateSupplierSchema } from "@/lib/validators"

// PATCH /api/suppliers/[id] — OWNER and MANAGER only
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
        { error: "You do not have permission to edit suppliers" },
        { status: 403 }
      )
    }

    const { id } = await params
    const body   = await request.json()

    const parsed = UpdateSupplierSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const existing = await prisma.supplier.findFirst({
      where: { id, businessId: session.user.businessId },
    })

    if (!existing) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 })
    }

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
        { error: "Only the account owner can delete suppliers" },
        { status: 403 }
      )
    }

    const { id } = await params

    const existing = await prisma.supplier.findFirst({
      where: { id, businessId: session.user.businessId },
    })

    if (!existing) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 })
    }

    // Unlink products — do not delete them
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
