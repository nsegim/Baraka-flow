import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UpdateCategorySchema } from "@/lib/validators"

// PATCH /api/categories/[id] — OWNER and MANAGER only
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
        { error: "You do not have permission to edit categories" },
        { status: 403 }
      )
    }

    const { id } = await params
    const body   = await request.json()

    const parsed = UpdateCategorySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const existing = await prisma.category.findFirst({
      where: { id, businessId: session.user.businessId },
    })

    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 })
    }

    const updated = await prisma.category.update({
      where: { id },
      data:  { name: parsed.data.name.trim() },
    })

    return NextResponse.json(updated)

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 })
  }
}

// DELETE /api/categories/[id] — OWNER only
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
        { error: "Only the account owner can delete categories" },
        { status: 403 }
      )
    }

    const { id } = await params

    const existing = await prisma.category.findFirst({
      where: { id, businessId: session.user.businessId },
    })

    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 })
    }

    // Unlink products — do not delete them
    await prisma.product.updateMany({
      where: { categoryId: id },
      data:  { categoryId: null },
    })

    await prisma.category.delete({ where: { id } })

    return NextResponse.json({ message: "Category deleted" })

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 })
  }
}
