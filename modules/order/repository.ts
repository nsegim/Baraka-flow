import { prisma }                             from "@/lib/prisma"
import { ORDER_LIST_INCLUDE, ORDER_CREATE_INCLUDE } from "@/lib/selects"
import type { CreateOrderInput }               from "./schema"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OrderItem {
  productId: string
  quantity:  number
}

export interface StockInfo {
  name:      string
  stock:     number
  costPrice: number | null
}

// ── Repository ────────────────────────────────────────────────────────────────

export class OrderRepository {
  constructor(private readonly businessId: string) {}

  async list(opts: {
    branchId?:      string | null
    page:           number
    limit:          number
    status?:        string
    paymentStatus?: string
    month?:         string
    search?:        string
  }) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { businessId: this.businessId }
    if (opts.branchId)      where.branchId      = opts.branchId
    if (opts.status)        where.status        = opts.status
    if (opts.paymentStatus) where.paymentStatus = opts.paymentStatus
    if (opts.month) {
      const [year, mon] = opts.month.split("-").map(Number)
      where.createdAt = { gte: new Date(year, mon - 1, 1), lt: new Date(year, mon, 1) }
    }
    if (opts.search) {
      where.OR = [
        { customerName:  { contains: opts.search, mode: "insensitive" } },
        { orderNumber:   { contains: opts.search, mode: "insensitive" } },
        { customerPhone: { contains: opts.search, mode: "insensitive" } },
      ]
    }

    return prisma.$transaction([
      prisma.order.findMany({
        where,
        include: ORDER_LIST_INCLUDE,
        orderBy: { createdAt: "desc" },
        skip:    (opts.page - 1) * opts.limit,
        take:    opts.limit,
      }),
      prisma.order.count({ where }),
    ])
  }

  async findById(id: string, branchId?: string | null) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { id, businessId: this.businessId }
    if (branchId) where.branchId = branchId
    return prisma.order.findFirst({ where, include: ORDER_LIST_INCLUDE })
  }

  async findByIdWithItems(id: string) {
    return prisma.order.findFirst({
      where:   { id, businessId: this.businessId },
      include: { items: true },
    })
  }

  async getTaxRate(): Promise<number> {
    const rows = await prisma.$queryRaw<{ taxRate: string }[]>`
      SELECT "taxRate"::text FROM "Business" WHERE id = ${this.businessId}
    `.catch(() => [{ taxRate: "0.18" }])
    return Number(rows[0]?.taxRate ?? 0.18)
  }

  async validateStock(
    productIds: string[],
    branchId:   string,
  ): Promise<{ products: Map<string, StockInfo>; error?: string }> {
    const [productRows, inventoryRows] = await Promise.all([
      prisma.product.findMany({
        where:  { id: { in: productIds }, businessId: this.businessId },
        select: { id: true, name: true, costPrice: true },
      }),
      prisma.branchInventory.findMany({
        where:  { branchId, productId: { in: productIds } },
        select: { productId: true, stock: true },
      }),
    ])

    if (productRows.length !== productIds.length) {
      const found   = new Set(productRows.map(p => p.id))
      const missing = productIds.find(id => !found.has(id))
      return { products: new Map(), error: `Product not found: ${missing}` }
    }

    const byStock = new Map(inventoryRows.map(i => [i.productId, Number(i.stock)]))
    const products = new Map<string, StockInfo>(
      productRows.map(p => [p.id, {
        name:      p.name,
        stock:     byStock.get(p.id) ?? 0,
        costPrice: p.costPrice !== null ? Number(p.costPrice) : null,
      }]),
    )
    return { products }
  }

  async generateOrderNumber(branchCode: string): Promise<string> {
    const year = new Date().getFullYear()
    for (let attempt = 0; attempt < 10; attempt++) {
      const count     = await prisma.order.count({ where: { businessId: this.businessId } })
      const candidate = `ORD-${branchCode}-${year}-${String(count + 1 + attempt).padStart(4, "0")}`
      const exists    = await prisma.order.findFirst({ where: { orderNumber: candidate, businessId: this.businessId } })
      if (!exists) return candidate
    }
    return `ORD-${branchCode}-${year}-${Date.now().toString(36).toUpperCase()}`
  }

  async create(
    data:        CreateOrderInput,
    branchId:    string,
    userId:      string,
    orderNumber: string,
    subtotal:    number,
    taxRate:     number,
    taxAmount:   number,
    totalAmount: number,
    dueDate:     Date | null,
    productMap:  Map<string, StockInfo>,
  ) {
    return prisma.$transaction(async (tx) => {
      return tx.order.create({
        data: {
          orderNumber,
          customerName:  data.customerName.trim(),
          customerPhone: data.customerPhone ?? null,
          customerId:    data.customerId    ?? null,
          notes:         data.notes         ?? null,
          paymentTerms:  data.paymentTerms,
          dueDate,
          subtotal,
          taxRate,
          taxAmount,
          totalAmount,
          status:     "PENDING",
          businessId: this.businessId,
          branchId,
          userId,
          items: {
            create: data.items.map(item => ({
              productId: item.productId,
              quantity:  item.quantity,
              unitPrice: item.unitPrice,
              costPrice: productMap.get(item.productId)?.costPrice ?? null,
            })),
          },
        },
        include: ORDER_CREATE_INCLUDE,
      })
    })
  }

  async updateStatus(
    id:       string,
    status:   string,
    branchId: string,
    items:    OrderItem[],
    userId:   string,
    orderNumber: string,
    customerId:  string | null,
    totalAmount: number,
    amountPaid:  number,
  ) {
    if (status === "DELIVERED") {
      await prisma.$transaction(async (tx) => {
        for (const item of items) {
          await tx.branchInventory.upsert({
            where:  { branchId_productId: { branchId, productId: item.productId } },
            update: { stock: { decrement: item.quantity } },
            create: { branchId, productId: item.productId, stock: 0 },
          })
          await tx.stockMovement.create({
            data: {
              type:      "SALE",
              quantity:  -item.quantity,
              reason:    `Order ${orderNumber} delivered`,
              productId: item.productId,
              branchId,
              userId,
            },
          })
        }
        await tx.order.update({ where: { id }, data: { status } })

        if (customerId) {
          const unpaid = totalAmount - amountPaid
          if (unpaid > 0) {
            await tx.customer.update({
              where: { id: customerId },
              data:  { outstandingBalance: { increment: unpaid } },
            })
          }
        }
      })

      await prisma.$executeRaw`
        UPDATE "Order"
        SET "deliveredAt" = NOW(), "updatedAt" = NOW()
        WHERE id = ${id}
      `.catch(() => {})
    } else {
      await prisma.order.update({ where: { id }, data: { status: status as import("@/lib/generated/prisma/enums").OrderStatus } })
    }

    return prisma.order.findFirst({ where: { id }, include: ORDER_LIST_INCLUDE })
  }

  async restockAndDelete(
    id:          string,
    branchId:    string,
    items:       OrderItem[],
    orderNumber: string,
    wasDelivered: boolean,
  ) {
    await prisma.$transaction(async (tx) => {
      if (wasDelivered) {
        for (const item of items) {
          await tx.branchInventory.upsert({
            where:  { branchId_productId: { branchId, productId: item.productId } },
            update: { stock: { increment: item.quantity } },
            create: { branchId, productId: item.productId, stock: item.quantity },
          })
          await tx.stockMovement.create({
            data: {
              type:      "RETURN",
              quantity:  item.quantity,
              reason:    `Order ${orderNumber} deleted — stock restored`,
              productId: item.productId,
              branchId,
            },
          })
        }
      }
      await tx.orderItem.deleteMany({ where: { orderId: id } })
      await tx.order.delete({ where: { id } })
    })
  }

  async restockAndCancel(
    id:          string,
    branchId:    string,
    items:       Array<OrderItem & { productName: string }>,
    orderNumber: string,
    reason:      string,
    userId:      string,
    customerId:  string | null,
    totalAmount: number,
  ) {
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        await tx.branchInventory.upsert({
          where:  { branchId_productId: { branchId, productId: item.productId } },
          update: { stock: { increment: item.quantity } },
          create: { branchId, productId: item.productId, stock: item.quantity, minStock: 0 },
        })
        await tx.stockMovement.create({
          data: {
            type:      "RETURN",
            quantity:  item.quantity,
            reason:    `Return: ${orderNumber} — ${reason}`,
            productId: item.productId,
            userId,
            branchId,
          },
        })
      }
      await tx.order.update({
        where: { id },
        data:  { status: "CANCELLED", notes: `RETURNED: ${reason}` },
      })
    })

    if (customerId) {
      const year     = new Date().getFullYear()
      const countRaw = await prisma.$queryRaw<{ count: string }[]>`
        SELECT COUNT(*)::text AS count FROM "CreditNote" WHERE "businessId" = ${this.businessId}
      `.catch(() => [{ count: "0" }])
      const creditNoteNumber = `CN-${year}-${String(Number(countRaw[0]?.count ?? 0) + 1).padStart(4, "0")}`
      const now = new Date()

      await prisma.$transaction([
        prisma.$executeRaw`
          INSERT INTO "CreditNote"
            (id, "creditNoteNumber", amount, reason, notes, status,
             "customerId", "businessId", "createdById", "createdAt", "updatedAt")
          VALUES
            (gen_random_uuid()::text, ${creditNoteNumber}, ${totalAmount}::numeric,
             ${`Return of ${orderNumber}: ${reason}`}, null, 'ISSUED',
             ${customerId}, ${this.businessId}, ${userId}, ${now}, ${now})
        `,
        prisma.$executeRaw`
          UPDATE "Customer"
          SET "outstandingBalance" = "outstandingBalance" - ${totalAmount}::numeric,
              "updatedAt" = NOW()
          WHERE id = ${customerId} AND "businessId" = ${this.businessId}
        `,
      ])

      return { creditNoteNumber, amount: totalAmount }
    }

    return null
  }

  async getLowStockAfterDelivery(branchId: string, productIds: string[]) {
    const inventories = await prisma.branchInventory.findMany({
      where:   { branchId, productId: { in: productIds } },
      include: { product: { select: { name: true } } },
    })
    return inventories.filter(inv => inv.stock <= inv.minStock)
  }
}
