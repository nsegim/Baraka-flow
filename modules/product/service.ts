import { createAuditLog }                    from "@/lib/audit"
import { checkPlanLimit }                    from "@/lib/plan-limits"
import { checkSubscription }                 from "@/lib/subscription"
import { NotFoundError, PlanLimitError }     from "@/lib/permissions"
import { ProductRepository }      from "./repository"
import type { CreateProductInput, UpdateProductInput } from "./schema"

// ── ProductService ────────────────────────────────────────────────────────────
// Business logic layer. Throws typed errors; callers convert to HTTP responses.

export class ProductService {
  private repo: ProductRepository

  constructor(
    private readonly businessId: string,
    private readonly userId: string,
  ) {
    this.repo = new ProductRepository(businessId)
  }

  async list(opts: {
    branchId?:   string | null
    page:        number
    limit:       number
    search?:     string
    categoryId?: string
    supplierId?: string
  }) {
    return this.repo.list(opts)
  }

  async listAll(branchId: string | null, search?: string) {
    return this.repo.listAll(branchId, search)
  }

  async getById(id: string, branchId?: string | null) {
    const product = await this.repo.findById(id, branchId)
    if (!product) throw new NotFoundError("Product not found")
    return product
  }

  async create(data: CreateProductInput, branchId: string) {
    const subCheck = await checkSubscription(this.businessId)
    if (!subCheck.allowed) throw new PlanLimitError(subCheck.message)

    const limitCheck = await checkPlanLimit(this.businessId, "products")
    if (!limitCheck.allowed) throw new PlanLimitError(limitCheck.error!)

    const templateIds    = data.attributeValues?.map(av => av.templateId) ?? []
    const validTemplates = await this.repo.validateTemplates(templateIds)

    const product = await this.repo.create(data, branchId, this.userId, validTemplates)

    createAuditLog({
      businessId: this.businessId,
      branchId,
      userId:     this.userId,
      action:     "PRODUCT_CREATED",
      entityType: "Product",
      entityId:   product.id,
      metadata:   { name: product.name, sku: product.sku, price: Number(product.price), stock: data.stock },
    })

    return product
  }

  async update(id: string, data: UpdateProductInput, branchId: string | null) {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError("Product not found")

    const templateIds    = data.attributeValues?.map(av => av.templateId) ?? []
    const validTemplates = await this.repo.validateTemplates(templateIds)

    const updated = await this.repo.update(id, data, branchId, this.userId, validTemplates)

    // PRODUCT_UPDATED is not yet in the AuditAction enum — audit on create/delete only

    return updated
  }

  async delete(id: string) {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError("Product not found")

    await this.repo.delete(id)

    createAuditLog({
      businessId: this.businessId,
      userId:     this.userId,
      action:     "PRODUCT_DELETED",
      entityType: "Product",
      entityId:   id,
      metadata:   { name: existing.name, sku: existing.sku },
    })
  }
}

// ── Utility ───────────────────────────────────────────────────────────────────

export function withStockSummary(
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
