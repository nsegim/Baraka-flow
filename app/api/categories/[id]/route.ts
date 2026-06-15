import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// DELETE — remove a category
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

    // Make sure this category belongs to this business
    const category = await prisma.category.findFirst({
      where: {
        id,
        businessId: session.user.businessId
      }
    })

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      )
    }

    // Unlink products from this category before deleting
    // Products are NOT deleted — just become uncategorized
    await prisma.product.updateMany({
      where: { categoryId: id },
      data:  { categoryId: null }
    })

    await prisma.category.delete({
      where: { id }
    })

    return NextResponse.json({ message: "Category deleted" })

  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Failed to delete category" },
      { status: 500 }
    )
  }


}


// PATCH — rename a category
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

    const { id }   = await params
    const { name } = await request.json()

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      )
    }

    // Security check
    const existing = await prisma.category.findFirst({
      where: {
        id,
        businessId: session.user.businessId
      }
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      )
    }

    const updated = await prisma.category.update({
      where: { id },
      data:  { name: name.trim() }
    })

    return NextResponse.json(updated)

  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Failed to update category" },
      { status: 500 }
    )
  }
}