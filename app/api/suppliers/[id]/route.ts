import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// PATCH — update supplier
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

    const { id } = await params
    const body   = await request.json()

    // Security check
    const existing = await prisma.supplier.findFirst({
      where: { id, businessId: session.user.businessId }
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Supplier not found" },
        { status: 404 }
      )
    }

    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        name:    body.name    ?? existing.name,
        email:   body.email   ?? existing.email,
        phone:   body.phone   ?? existing.phone,
        country: body.country ?? existing.country,
      },
      include: {
        _count: { select: { products: true } }
      }
    })

    return NextResponse.json(updated)

  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Failed to update supplier" },
      { status: 500 }
    )
  }
}

// DELETE — remove supplier
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

    const existing = await prisma.supplier.findFirst({
      where: { id, businessId: session.user.businessId }
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Supplier not found" },
        { status: 404 }
      )
    }

    // Unlink products — don't delete them
    await prisma.product.updateMany({
      where: { supplierId: id },
      data:  { supplierId: null }
    })

    await prisma.supplier.delete({
      where: { id }
    })

    return NextResponse.json({ message: "Supplier deleted" })

  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Failed to delete supplier" },
      { status: 500 }
    )
  }
}