import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UpdateProductSchema } from "@/lib/validators"
import { serialize } from "@/lib/serialize"
import { createAuditLog } from "@/lib/audit"
import { getIp } from "@/lib/rate-limit"
import { requireBranchContext, isBranchContext, getWriteBranchId } from "@/lib/branch-auth"

// PATCH /api/products/[id] — OWNER and MANAGER only
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireBranchContext(request)
    if (!isBranchContext(ctx)) return ctx

    if (!["OWNER", "MANAGER"].includes(ctx.session.user.role)) {
      return NextResponse.json({ error: "You do not have permission to edit products" }, { status: 403 })
    }

    const branchId = getWriteBranchId(ctx, new URL(request.url).searchParams.get("branchId"))

    const { id } = await params
    const body   = await request.json()
    const parsed = UpdateProductSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const existing = await prisma.product.findFirst({
      where: { id, businessId: ctx.session.user.businessId },
    })
    if (!existing) return NextResponse.json({ error: "Product not found" }, { status: 404 })

    // Update catalog fields on Product (including the flexible attributes JSON blob)
    const updated = await prisma.product.update({
      where: { id },
      data: {
        name:        parsed.data.name        ?? existing.name,
        description: parsed.data.description ?? existing.description,
        sku:         parsed.data.sku         ?? existing.sku,
        price:       parsed.data.price       ?? existing.price,
        costPrice:   parsed.data.costPrice   ?? existing.costPrice,
        unit:        parsed.data.unit        ?? existing.unit,
        origin:      parsed.data.origin      ?? existing.origin,
        categoryId:  parsed.data.categoryId  ?? existing.categoryId,
        supplierId:  parsed.data.supplierId  ?? existing.supplierId,
        ...(parsed.data.attributes !== undefined
          ? { attributes: parsed.data.attributes ? (parsed.data.attributes as object) : undefined }
          : {}),
      },
      include: { category: true, supplier: true },
    })

    // Upsert / delete structured attribute values when provided
    if (parsed.data.attributeValues && parsed.data.attributeValues.length > 0) {
      const templateIds = parsed.data.attributeValues.map(av => av.templateId)
      const validTemplates = await prisma.attributeTemplate.findMany({
        where:  { id: { in: templateIds }, businessId: ctx.session.user.businessId, isActive: true },
        select: { id: true },
      })
      const validSet = new Set(validTemplates.map(t => t.id))

      for (const av of parsed.data.attributeValues) {
        if (!validSet.has(av.templateId)) continue
        if (av.value === "") {
          // Empty string = intent to remove this attribute value
          await prisma.productAttributeValue.deleteMany({
            where: { productId: id, attributeTemplateId: av.templateId },
          })
        } else {
          await prisma.productAttributeValue.upsert({
            where:  { productId_attributeTemplateId: { productId: id, attributeTemplateId: av.templateId } },
            create: { productId: id, attributeTemplateId: av.templateId, value: av.value },
            update: { value: av.value },
          })
        }
      }
    }

    // Update stock/minStock in BranchInventory when a branch context exists
    if (branchId && (parsed.data.stock !== undefined || parsed.data.minStock !== undefined)) {
      const currentInv = await prisma.branchInventory.findUnique({
        where: { branchId_productId: { branchId, productId: id } },
      })
      const currentStock = currentInv?.stock ?? 0
      const newStock     = parsed.data.stock ?? currentStock

      await prisma.branchInventory.upsert({
        where:  { branchId_productId: { branchId, productId: id } },
        update: {
          stock:    newStock,
          minStock: parsed.data.minStock ?? (currentInv?.minStock ?? 5),
        },
        create: {
          branchId,
          productId: id,
          stock:    newStock,
          minStock: parsed.data.minStock ?? 5,
        },
      })

      // Log stock movement if quantity changed
      if (parsed.data.stock !== undefined && parsed.data.stock !== currentStock) {
        const delta = parsed.data.stock - currentStock
        await prisma.stockMovement.create({
          data: {
            type:      delta > 0 ? "IMPORT" : "ADJUSTMENT",
            quantity:  delta,
            reason:    parsed.data.stockReason ?? "Manual stock adjustment",
            productId: id,
            branchId,
            userId:    ctx.session.user.id,
          },
        })
      }
    }

    return NextResponse.json(serialize(updated))
  } catch (error) {
    console.error("PATCH /api/products/[id] error:", error)
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 })
  }
}

// DELETE /api/products/[id] — OWNER only
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireBranchContext(request)
    if (!isBranchContext(ctx)) return ctx

    if (ctx.session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Only the account owner can delete products" }, { status: 403 })
    }

    const { id } = await params
    const existing = await prisma.product.findFirst({
      where: { id, businessId: ctx.session.user.businessId },
    })
    if (!existing) return NextResponse.json({ error: "Product not found" }, { status: 404 })

    await prisma.$transaction([
      prisma.branchInventory.deleteMany({ where: { productId: id } }),
      prisma.stockMovement.deleteMany({ where: { productId: id } }),
      prisma.product.delete({ where: { id } }),
    ])

    createAuditLog({
      businessId: ctx.session.user.businessId,
      userId:     ctx.session.user.id,
      action:     "PRODUCT_DELETED",
      entityType: "Product",
      entityId:   id,
      metadata:   { name: existing.name, sku: existing.sku },
      ipAddress:  getIp(request),
    })

    return NextResponse.json({ message: "Product deleted successfully" })
  } catch (error) {
    console.error("DELETE /api/products/[id] error:", error)
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 })
  }
}
