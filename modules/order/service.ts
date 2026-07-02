import { createAuditLog }                                  from "@/lib/audit"
import { createNotification }                               from "@/lib/notify"
import { checkPlanLimit }                                   from "@/lib/plan-limits"
import { checkSubscription }                                from "@/lib/subscription"
import { NotFoundError, PlanLimitError, ValidationError }   from "@/lib/permissions"
import { sendOrderConfirmation }                from "@/lib/email"
import { prisma }                               from "@/lib/prisma"
import { OrderRepository }                      from "./repository"
import type { CreateOrderInput, UpdateOrderStatusInput, ReturnOrderInput } from "./schema"

function computeDueDate(terms: string): Date | null {
  const days: Record<string, number> = { COD: 0, NET_7: 7, NET_14: 14, NET_30: 30, NET_60: 60 }
  const d = days[terms]
  if (d === undefined || d === 0) return null
  const date = new Date()
  date.setDate(date.getDate() + d)
  return date
}

export class OrderService {
  private repo: OrderRepository

  constructor(
    private readonly businessId: string,
    private readonly userId: string,
  ) {
    this.repo = new OrderRepository(businessId)
  }

  async list(opts: {
    branchId?:      string | null
    page:           number
    limit:          number
    status?:        string
    paymentStatus?: string
    month?:         string
    search?:        string
  }) {
    return this.repo.list(opts)
  }

  async getById(id: string, branchId?: string | null) {
    const order = await this.repo.findById(id, branchId)
    if (!order) throw new NotFoundError("Order not found")
    return order
  }

  async create(data: CreateOrderInput, branchId: string, branchName: string, branchCode: string) {
    const subCheck = await checkSubscription(this.businessId)
    if (!subCheck.allowed) throw new PlanLimitError(subCheck.message)

    const limitCheck = await checkPlanLimit(this.businessId, "orders")
    if (!limitCheck.allowed) throw new PlanLimitError(limitCheck.error!)

    const productIds = data.items.map(i => i.productId)
    const { products, error } = await this.repo.validateStock(productIds, branchId)
    if (error) throw new ValidationError(error)

    for (const item of data.items) {
      const info = products.get(item.productId)!
      if (info.stock < item.quantity) {
        throw new ValidationError(
          `Insufficient stock for "${info.name}" at ${branchName}. ` +
          `Available: ${info.stock}, requested: ${item.quantity}.`,
        )
      }
    }

    const taxRate    = await this.repo.getTaxRate()
    const subtotal   = data.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)
    const taxAmount  = Math.round(subtotal * taxRate * 100) / 100
    const total      = subtotal + taxAmount
    const dueDate    = computeDueDate(data.paymentTerms)
    const orderNum   = await this.repo.generateOrderNumber(branchCode)

    const order = await this.repo.create(
      data, branchId, this.userId,
      orderNum, subtotal, taxRate, taxAmount, total, dueDate, products,
    )

    createNotification(
      this.businessId,
      "NEW_ORDER",
      `New Order — ${orderNum}`,
      `${data.customerName} · RWF ${total.toLocaleString()}`,
      "/orders",
      branchId,
    )

    createAuditLog({
      businessId: this.businessId,
      branchId,
      userId:     this.userId,
      action:     "ORDER_CREATED",
      entityType: "Order",
      entityId:   order.id,
      metadata:   { orderNumber: orderNum, customerName: data.customerName, totalAmount: total },
    })

    // Fire-and-forget email confirmation
    prisma.business.findUnique({
      where:  { id: this.businessId },
      select: { name: true, email: true },
    }).then(biz => {
      if (biz?.email) {
        sendOrderConfirmation({
          to:           biz.email,
          businessName: biz.name,
          orderNumber:  orderNum,
          customerName: data.customerName,
          items:        order.items.map(i => ({
            name:      i.product.name,
            quantity:  i.quantity,
            unitPrice: Number(i.unitPrice),
          })),
          totalAmount: total,
        }).catch(() => {})
      }
    }).catch(() => {})

    // Warn if any items are missing cost price (affects margin reports)
    const warnings = data.items
      .filter(i => products.get(i.productId)?.costPrice === null)
      .map(i => products.get(i.productId)!.name)

    return { order, warnings: warnings.length > 0
      ? [`COGS will be incomplete: ${warnings.join(", ")} ${warnings.length === 1 ? "has" : "have"} no cost price set.`]
      : [],
    }
  }

  async updateStatus(id: string, input: UpdateOrderStatusInput, branchId?: string | null) {
    const existing = await this.repo.findByIdWithItems(id)
    if (!existing)           throw new NotFoundError("Order not found")
    if (!existing.branchId)  throw new ValidationError("Order has no branch assigned")

    const { status, deliveryNotes: _notes } = input
    const orderBranchId = existing.branchId

    const updated = await this.repo.updateStatus(
      id,
      status,
      orderBranchId,
      existing.items,
      this.userId,
      existing.orderNumber,
      existing.customerId,
      Number(existing.totalAmount),
      Number(existing.amountPaid),
    )

    if (status === "DELIVERED") {
      createNotification(
        this.businessId,
        "ORDER_DELIVERED",
        `Order Delivered — ${existing.orderNumber}`,
        `${existing.customerName}'s order has been marked as delivered`,
        "/orders",
        orderBranchId,
      )

      const lowStock = await this.repo.getLowStockAfterDelivery(
        orderBranchId,
        existing.items.map(i => i.productId),
      )
      if (lowStock.length > 0) {
        createNotification(
          this.businessId,
          "LOW_STOCK",
          `Low Stock Alert — ${lowStock.length} product${lowStock.length > 1 ? "s" : ""}`,
          lowStock.map(inv => `${inv.product.name} (${inv.stock} left)`).join(", "),
          "/stock-alerts",
          orderBranchId,
        )
      }
    } else if (status === "CANCELLED") {
      createNotification(
        this.businessId,
        "ORDER_CANCELLED",
        `Order Cancelled — ${existing.orderNumber}`,
        `${existing.customerName}'s order was cancelled`,
        "/orders",
        orderBranchId,
      )
    }

    createAuditLog({
      businessId: this.businessId,
      branchId:   orderBranchId,
      userId:     this.userId,
      action:     "ORDER_STATUS_CHANGED",
      entityType: "Order",
      entityId:   id,
      metadata:   { orderNumber: existing.orderNumber, from: existing.status, to: status },
    })

    return updated
  }

  async delete(id: string) {
    const existing = await this.repo.findByIdWithItems(id)
    if (!existing)          throw new NotFoundError("Order not found")
    if (!existing.branchId) throw new ValidationError("Order has no branch assigned")

    await this.repo.restockAndDelete(
      id,
      existing.branchId,
      existing.items,
      existing.orderNumber,
      existing.status === "DELIVERED",
    )

    createAuditLog({
      businessId: this.businessId,
      branchId:   existing.branchId,
      userId:     this.userId,
      action:     "ORDER_DELETED",
      entityType: "Order",
      entityId:   id,
      metadata:   { orderNumber: existing.orderNumber, customerName: existing.customerName, status: existing.status },
    })
  }

  async processReturn(id: string, input: ReturnOrderInput) {
    const { reason, issueCreditNote } = input

    const order = await this.repo.findByIdWithItems(id)
    if (!order)           throw new NotFoundError("Order not found")
    if (!order.branchId)  throw new ValidationError("Order has no branch assigned")
    if (order.status !== "DELIVERED") {
      throw new ValidationError("Only delivered orders can be returned")
    }

    const items = order.items.map(item => ({
      productId:   item.productId,
      quantity:    item.quantity,
      productName: "", // product name not needed for stock ops
    }))

    const creditNote = issueCreditNote && order.customerId
      ? await this.repo.restockAndCancel(
          id,
          order.branchId,
          items,
          order.orderNumber,
          reason,
          this.userId,
          order.customerId,
          Number(order.totalAmount),
        )
      : (await this.repo.restockAndCancel(
          id, order.branchId, items, order.orderNumber,
          reason, this.userId, null, 0,
        ), null)

    createNotification(
      this.businessId,
      "ORDER_RETURNED",
      `Order Returned — ${order.orderNumber}`,
      `${order.customerName} · Reason: ${reason}`,
      "/orders",
    )

    return { creditNote }
  }
}
