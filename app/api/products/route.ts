import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { CreateProductSchema } from "@/lib/validators"
import { serialize } from "@/lib/serialize"
import { createAuditLog } from "@/lib/audit"
import { getIp } from "@/lib/rate-limit"
import { requireBranchContext, isBranchContext, getWriteBranchId } from "@/lib/branch-auth"
import { checkPlanLimit } from "@/lib/plan-limits"

// GET /api/products
// Supports ?all=true (no pagination — for dropdowns)
// Supports ?page=N&limit=N (paginated — for the inventory table)
// Products are catalog-level (business-wide). Stock per branch is in BranchInventory.
// When a branchId context is active, returns stock for that branch.
// When OWNER views all branches, returns total stock across all branches.
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireBranchContext(request)
    if (!isBranchContext(ctx)) return ctx

    const { searchParams } = request.nextUrl
    const fetchAll   = searchParams.get("all") === "true"
    const page       = Math.max(1, parseInt(searchParams.get("page")  ?? "1"))
    const limit      = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50")))
    const skip       = (page - 1) * limit
    const search     = searchParams.get("search")?.trim()
    const categoryId = searchParams.get("categoryId")
    const supplierId = searchParams.get("supplierId")

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { businessId: ctx.session.user.businessId }
    if (categoryId) where.categoryId = categoryId
    if (supplierId) where.supplierId = supplierId
    if (search) {
      where.OR = [
        { name:        { contains: search, mode: "insensitive" } },
        { sku:         { contains: search, mode: "insensitive" } },
        { origin:      { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ]
    }

    // Build inventory include: scoped to branch when context has one, else aggregate
    const inventoryFilter = ctx.branchId
      ? { where: { branchId: ctx.branchId } }
      : true

    const productInclude = {
      category:  true,
      supplier:  true,
      inventory: inventoryFilter,
      attributeValues: {
        where:   { attributeTemplate: { isActive: true } },
        include: {
          attributeTemplate: {
            select: { id: true, name: true, key: true, type: true, unit: true, sortOrder: true },
          },
        },
        orderBy: { attributeTemplate: { sortOrder: "asc" as const } },
      },
    }

    if (fetchAll) {
      const products = await prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: { name: "asc" },
        take:    1000,
      })
      return NextResponse.json(serialize(withStockSummary(products, ctx.branchId)))
    }

    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take:    limit,
      }),
      prisma.product.count({ where }),
    ])

    return NextResponse.json({
      data: serialize(withStockSummary(products, ctx.branchId)),
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error("GET /api/products error:", error)
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 })
  }
}

// Flatten BranchInventory into a stock/minStock summary on each product
function withStockSummary(
  products: Array<{ inventory: Array<{ stock: number; minStock: number }>; [key: string]: unknown }>,
  branchId: string | null,
) {
  return products.map(({ inventory, ...p }) => ({
    ...p,
    stock:    branchId
      ? (inventory[0]?.stock    ?? 0)
      : inventory.reduce((sum, i) => sum + i.stock, 0),
    minStock: branchId
      ? (inventory[0]?.minStock ?? 5)
      : Math.max(...inventory.map(i => i.minStock), 5),
  }))
}

// POST /api/products — OWNER and MANAGER only
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireBranchContext(request, { requireBranch: true })
    if (!isBranchContext(ctx)) return ctx

    if (!["OWNER", "MANAGER"].includes(ctx.session.user.role)) {
      return NextResponse.json({ error: "You do not have permission to add products" }, { status: 403 })
    }

    const branchId = getWriteBranchId(ctx, new URL(request.url).searchParams.get("branchId"))
    if (!branchId) {
      return NextResponse.json({ error: "Select a branch before adding products" }, { status: 400 })
    }

    // Plan enforcement
    const limitCheck = await checkPlanLimit(ctx.session.user.businessId, "products")
    if (!limitCheck.allowed) {
      return NextResponse.json({ error: limitCheck.error }, { status: 403 })
    }

    const body   = await request.json()
    const parsed = CreateProductSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const {
      name, description, sku, price, costPrice,
      stock, minStock, unit, origin, categoryId, supplierId,
      attributes, attributeValues,
    } = parsed.data

    // Validate attributeValues templateIds belong to this business before entering transaction
    let validTemplateIds = new Set<string>()
    if (attributeValues && attributeValues.length > 0) {
      const templateIds = attributeValues.map(av => av.templateId)
      const validTemplates = await prisma.attributeTemplate.findMany({
        where:  { id: { in: templateIds }, businessId: ctx.session.user.businessId, isActive: true },
        select: { id: true },
      })
      validTemplateIds = new Set(validTemplates.map(t => t.id))
    }

    const product = await prisma.$transaction(async (tx) => {
      const newProduct = await tx.product.create({
        data: {
          name,
          description: description ?? null,
          sku:         sku         ?? null,
          price,
          costPrice:   costPrice   ?? null,
          unit,
          origin:      origin      ?? null,
          attributes:  attributes ? (attributes as object) : undefined,
          categoryId:  categoryId  ?? null,
          supplierId:  supplierId  ?? null,
          businessId:  ctx.session.user.businessId,
        },
        include: { category: true, supplier: true },
      })

      // Create BranchInventory for ALL active branches (stock 0 on others, initial on selected)
      const allBranches = await tx.branch.findMany({
        where:  { businessId: ctx.session.user.businessId, isActive: true },
        select: { id: true },
      })
      await tx.branchInventory.createMany({
        data: allBranches.map(b => ({
          branchId:  b.id,
          productId: newProduct.id,
          stock:     b.id === branchId ? (stock ?? 0) : 0,
          minStock:  b.id === branchId ? (minStock ?? 5) : 5,
        })),
        skipDuplicates: true,
      })

      // Log initial stock movement if stock > 0
      if ((stock ?? 0) > 0) {
        await tx.stockMovement.create({
          data: {
            type:      "IMPORT",
            quantity:  stock,
            reason:    "Initial stock on product creation",
            productId: newProduct.id,
            branchId,
            userId:    ctx.session.user.id,
          },
        })
      }

      // Save structured attribute values (only for validated templates)
      const validValues = (attributeValues ?? []).filter(
        av => validTemplateIds.has(av.templateId) && av.value !== "",
      )
      if (validValues.length > 0) {
        await tx.productAttributeValue.createMany({
          data: validValues.map(av => ({
            productId:           newProduct.id,
            attributeTemplateId: av.templateId,
            value:               av.value,
          })),
          skipDuplicates: true,
        })
      }

      return newProduct
    })

    createAuditLog({
      businessId: ctx.session.user.businessId,
      branchId,
      userId:     ctx.session.user.id,
      action:     "PRODUCT_CREATED",
      entityType: "Product",
      entityId:   product.id,
      metadata:   { name: product.name, sku: product.sku, price: Number(product.price), stock },
      ipAddress:  getIp(request),
    })

    return NextResponse.json(serialize({ ...product, stock: stock ?? 0, minStock: minStock ?? 5 }), { status: 201 })
  } catch (error) {
    console.error("POST /api/products error:", error)
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 })
  }
}
