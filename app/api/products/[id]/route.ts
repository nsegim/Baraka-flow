// [id] in the folder name means this is a dynamic route
// /api/products/abc123 → id = "abc123"
// /api/products/xyz789 → id = "xyz789"

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// ─────────────────────────────────────────
// PATCH /api/products/[id]
// Update a product
// ─────────────────────────────────────────
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

    // Security check — make sure this product belongs
    // to the logged-in user's business
    // Without this, any logged-in user could edit
    // another business's products
    const existing = await prisma.product.findFirst({
      where: {
        id,
        businessId: session.user.businessId
      }
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      )
    }

    // If stock is being changed — record the movement
    if (body.stock !== undefined && body.stock !== existing.stock) {
      const difference = body.stock - existing.stock

      await prisma.stockMovement.create({
        data: {
          type:      difference > 0 ? "IMPORT" : "ADJUSTMENT",
          quantity:  difference,
          reason:    body.stockReason || "Manual stock adjustment",
          productId: id,
        }
      })
    }

    // Update the product
    const updated = await prisma.product.update({
      where: { id },
      data: {
        name:        body.name        ?? existing.name,
        description: body.description ?? existing.description,
        sku:         body.sku         ?? existing.sku,
        price:       body.price       ? parseFloat(body.price)    : existing.price,
        costPrice:   body.costPrice   ? parseFloat(body.costPrice): existing.costPrice,
        stock:       body.stock       !== undefined ? parseInt(body.stock) : existing.stock,
        minStock:    body.minStock    !== undefined ? parseInt(body.minStock) : existing.minStock,
        unit:        body.unit        ?? existing.unit,
        origin:      body.origin      ?? existing.origin,
        categoryId:  body.categoryId  ?? existing.categoryId,
        supplierId:  body.supplierId  ?? existing.supplierId,
      },
      include: {
        category: true,
        supplier: true,
      }
    })

    return NextResponse.json(updated)

  } catch (error) {
    console.error("PATCH /api/products/[id] error:", error)
    return NextResponse.json(
      { error: "Failed to update product" },
      { status: 500 }
    )
  }
}

// ─────────────────────────────────────────
// DELETE /api/products/[id]
// Delete a product
// ─────────────────────────────────────────
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

    // Security check
    const existing = await prisma.product.findFirst({
      where: {
        id,
        businessId: session.user.businessId
      }
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      )
    }

    // Delete stock movements first
    // (because they reference this product — foreign key)
    await prisma.stockMovement.deleteMany({
      where: { productId: id }
    })

    // Then delete the product
    await prisma.product.delete({
      where: { id }
    })

    return NextResponse.json(
      { message: "Product deleted successfully" }
    )

  } catch (error) {
    console.error("DELETE /api/products/[id] error:", error)
    return NextResponse.json(
      { error: "Failed to delete product" },
      { status: 500 }
    )
  }
}