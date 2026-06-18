import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UpdateProductSchema } from "@/lib/validators"
import { serialize } from "@/lib/serialize"

// PATCH /api/products/[id] — OWNER and MANAGER only
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
        { error: "You do not have permission to edit products" },
        { status: 403 }
      )
    }

    const { id } = await params
    const body   = await request.json()

    const parsed = UpdateProductSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const existing = await prisma.product.findFirst({
      where: { id, businessId: session.user.businessId },
    })

    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    // Record stock movement when quantity changes
    if (parsed.data.stock !== undefined && parsed.data.stock !== existing.stock) {
      const difference = parsed.data.stock - existing.stock
      await prisma.stockMovement.create({
        data: {
          type:      difference > 0 ? "IMPORT" : "ADJUSTMENT",
          quantity:  difference,
          reason:    parsed.data.stockReason ?? "Manual stock adjustment",
          productId: id,
          // userId added after schema migration (Task 15)
        },
      })
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name:        parsed.data.name        ?? existing.name,
        description: parsed.data.description ?? existing.description,
        sku:         parsed.data.sku         ?? existing.sku,
        price:       parsed.data.price       ?? existing.price,
        costPrice:   parsed.data.costPrice   ?? existing.costPrice,
        stock:       parsed.data.stock       ?? existing.stock,
        minStock:    parsed.data.minStock    ?? existing.minStock,
        unit:        parsed.data.unit        ?? existing.unit,
        origin:      parsed.data.origin      ?? existing.origin,
        categoryId:  parsed.data.categoryId  ?? existing.categoryId,
        supplierId:  parsed.data.supplierId  ?? existing.supplierId,
      },
      include: { category: true, supplier: true },
    })

    return NextResponse.json(serialize(updated))

  } catch (error) {
    console.error("PATCH /api/products/[id] error:", error)
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 })
  }
}

// DELETE /api/products/[id] — OWNER only
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
        { error: "Only the account owner can delete products" },
        { status: 403 }
      )
    }

    const { id } = await params

    const existing = await prisma.product.findFirst({
      where: { id, businessId: session.user.businessId },
    })

    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    await prisma.stockMovement.deleteMany({ where: { productId: id } })
    await prisma.product.delete({ where: { id } })

    return NextResponse.json({ message: "Product deleted successfully" })

  } catch (error) {
    console.error("DELETE /api/products/[id] error:", error)
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 })
  }
}
