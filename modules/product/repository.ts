import { prisma }                from "@/lib/prisma"
import type { CreateProductInput, UpdateProductInput } from "./schema"

// ── Reusable include ──────────────────────────────────────────────────────────

function productInclude(branchId: string | null) {
  return {
    category:  true,
    supplier:  true,
    inventory: branchId ? { where: { branchId } } : true,
    attributeValues: {
      where:   { attributeTemplate: { isActive: true } },
      include: {
        attributeTemplate: {
          select: { id: true, name: true, key: true, type: true, unit: true, sortOrder: true },
        },
      },
      orderBy: { attributeTemplate: { sortOrder: "asc" as const } },
    },
  } as const
}

// ── Repository ────────────────────────────────────────────────────────────────
// All methods scope to this.businessId — cross-tenant leaks are structurally
// impossible here.

export class ProductRepository {
  constructor(private readonly businessId: string) {}

  async list(opts: {
    branchId?:   string | null
    page:        number
    limit:       number
    search?:     string
    categoryId?: string
    supplierId?: string
  }) {
    const { branchId = null, page, limit, search, categoryId, supplierId } = opts
    const where = this.buildWhere({ search, categoryId, supplierId })
    return prisma.$transaction([
      prisma.product.findMany({
        where,
        include: productInclude(branchId),
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      prisma.product.count({ where }),
    ])
  }

  async listAll(branchId: string | null, search?: string) {
    return prisma.product.findMany({
      where:   this.buildWhere({ search }),
      include: productInclude(branchId),
      orderBy: { name: "asc" },
      take:    1000,
    })
  }

  async findById(id: string, branchId?: string | null) {
    return prisma.product.findFirst({
      where:   { id, businessId: this.businessId },
      include: productInclude(branchId ?? null),
    })
  }

  async create(
    data:     CreateProductInput,
    branchId: string,
    userId:   string,
    validTemplateIds: Set<string>,
  ) {
    const { name, description, sku, price, costPrice, stock, minStock,
            unit, origin, attributes, categoryId, supplierId, attributeValues } = data

    return prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
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
          businessId:  this.businessId,
        },
        include: { category: true, supplier: true },
      })

      // Seed BranchInventory for every active branch
      const allBranches = await tx.branch.findMany({
        where:  { businessId: this.businessId, isActive: true },
        select: { id: true },
      })
      await tx.branchInventory.createMany({
        data: allBranches.map(b => ({
          branchId:  b.id,
          productId: product.id,
          stock:     b.id === branchId ? (stock ?? 0) : 0,
          minStock:  b.id === branchId ? (minStock ?? 5) : 5,
        })),
        skipDuplicates: true,
      })

      if ((stock ?? 0) > 0) {
        await tx.stockMovement.create({
          data: {
            type:      "IMPORT",
            quantity:  stock,
            reason:    "Initial stock on product creation",
            productId: product.id,
            branchId,
            userId,
          },
        })
      }

      const validValues = (attributeValues ?? []).filter(
        av => validTemplateIds.has(av.templateId) && av.value !== "",
      )
      if (validValues.length > 0) {
        await tx.productAttributeValue.createMany({
          data: validValues.map(av => ({
            productId:           product.id,
            attributeTemplateId: av.templateId,
            value:               av.value,
          })),
          skipDuplicates: true,
        })
      }

      return product
    })
  }

  async update(
    id:       string,
    data:     UpdateProductInput,
    branchId: string | null,
    userId:   string,
    validTemplateIds: Set<string>,
  ) {
    const existing = await this.findById(id)

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name:        data.name        ?? existing!.name,
        description: data.description ?? existing!.description,
        sku:         data.sku         ?? existing!.sku,
        price:       data.price       ?? existing!.price,
        costPrice:   data.costPrice   ?? existing!.costPrice,
        unit:        data.unit        ?? existing!.unit,
        origin:      data.origin      ?? existing!.origin,
        categoryId:  data.categoryId  ?? existing!.categoryId,
        supplierId:  data.supplierId  ?? existing!.supplierId,
        ...(data.attributes !== undefined
          ? { attributes: data.attributes ? (data.attributes as object) : undefined }
          : {}),
      },
      include: { category: true, supplier: true },
    })

    if (data.attributeValues && data.attributeValues.length > 0) {
      for (const av of data.attributeValues) {
        if (!validTemplateIds.has(av.templateId)) continue
        if (av.value === "") {
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

    if (branchId && (data.stock !== undefined || data.minStock !== undefined)) {
      const current = await prisma.branchInventory.findUnique({
        where: { branchId_productId: { branchId, productId: id } },
      })
      const currentStock = Number(current?.stock ?? 0)
      const newStock     = data.stock ?? currentStock

      await prisma.branchInventory.upsert({
        where:  { branchId_productId: { branchId, productId: id } },
        update: { stock: newStock, minStock: data.minStock ?? (current?.minStock ?? 5) },
        create: { branchId, productId: id, stock: newStock, minStock: data.minStock ?? 5 },
      })

      if (data.stock !== undefined && data.stock !== currentStock) {
        const delta = data.stock - currentStock
        await prisma.stockMovement.create({
          data: {
            type:      delta > 0 ? "IMPORT" : "ADJUSTMENT",
            quantity:  delta,
            reason:    data.stockReason ?? "Manual stock adjustment",
            productId: id,
            branchId,
            userId,
          },
        })
      }
    }

    return updated
  }

  async delete(id: string) {
    await prisma.$transaction([
      prisma.branchInventory.deleteMany({ where: { productId: id } }),
      prisma.stockMovement.deleteMany({ where: { productId: id } }),
      prisma.product.delete({ where: { id } }),
    ])
  }

  async validateTemplates(templateIds: string[]): Promise<Set<string>> {
    if (!templateIds.length) return new Set()
    const valid = await prisma.attributeTemplate.findMany({
      where:  { id: { in: templateIds }, businessId: this.businessId, isActive: true },
      select: { id: true },
    })
    return new Set(valid.map(t => t.id))
  }

  private buildWhere(opts: { search?: string; categoryId?: string; supplierId?: string }) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { businessId: this.businessId }
    if (opts.categoryId) where.categoryId = opts.categoryId
    if (opts.supplierId) where.supplierId = opts.supplierId
    if (opts.search) {
      where.OR = [
        { name:        { contains: opts.search, mode: "insensitive" } },
        { sku:         { contains: opts.search, mode: "insensitive" } },
        { origin:      { contains: opts.search, mode: "insensitive" } },
        { description: { contains: opts.search, mode: "insensitive" } },
      ]
    }
    return where
  }
}
