import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { CreateOrderSchema } from "@/lib/validators"
import { serialize } from "@/lib/serialize"
import { sendOrderConfirmation } from "@/lib/email"
import { createNotification } from "@/lib/notify"
import { createAuditLog } from "@/lib/audit"
import { getIp } from "@/lib/rate-limit"
import { requireBranchContext, isBranchContext, buildBranchWhere, getWriteBranchId } from "@/lib/branch-auth"
import { checkPlanLimit } from "@/lib/plan-limits"

// GET /api/orders — paginated, branch-scoped
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireBranchContext(request)
    if (!isBranchContext(ctx)) return ctx

    const { searchParams } = request.nextUrl
    const page          = Math.max(1, parseInt(searchParams.get("page")  ?? "1"))
    const limit         = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50")))
    const skip          = (page - 1) * limit
    const status        = searchParams.get("status")
    const paymentStatus = searchParams.get("paymentStatus")
    const month         = searchParams.get("month")
    const search        = searchParams.get("search")?.trim()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = buildBranchWhere(ctx)
    if (status)        where.status        = status
    if (paymentStatus) where.paymentStatus = paymentStatus
    if (month) {
      const [year, mon] = month.split("-").map(Number)
      where.createdAt = { gte: new Date(year, mon - 1, 1), lt: new Date(year, mon, 1) }
    }
    if (search) {
      where.OR = [
        { customerName:  { contains: search, mode: "insensitive" } },
        { orderNumber:   { contains: search, mode: "insensitive" } },
        { customerPhone: { contains: search, mode: "insensitive" } },
      ]
    }

    const [orders, total] = await prisma.$transaction([
      prisma.order.findMany({
        where,
        include: {
          items:    { include: { product: true } },
          user:     { select: { name: true } },
          payments: { orderBy: { paidAt: "desc" } },
          branch:   { select: { name: true, code: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ])

    return NextResponse.json({
      data: serialize(orders),
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 })
  }
}

// POST /api/orders — OWNER and MANAGER only
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireBranchContext(request, { requireBranch: true })
    if (!isBranchContext(ctx)) return ctx

    if (!["OWNER", "MANAGER"].includes(ctx.session.user.role)) {
      return NextResponse.json({ error: "You do not have permission to create orders" }, { status: 403 })
    }

    const branchId = getWriteBranchId(ctx, new URL(request.url).searchParams.get("branchId"))
    if (!branchId) {
      return NextResponse.json({ error: "Select a branch before creating an order" }, { status: 400 })
    }

    // Verify branch belongs to this business
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, businessId: ctx.session.user.businessId, isActive: true },
      select: { id: true, name: true, code: true },
    })
    if (!branch) return NextResponse.json({ error: "Branch not found" }, { status: 404 })

    // Plan enforcement
    const limitCheck = await checkPlanLimit(ctx.session.user.businessId, "orders")
    if (!limitCheck.allowed) {
      return NextResponse.json({ error: limitCheck.error }, { status: 403 })
    }

    const body   = await request.json()
    const parsed = CreateOrderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { customerName, customerPhone, customerId, paymentTerms, notes, items } = parsed.data

    // Fetch business tax rate
    const taxRateRaw = await prisma.$queryRaw<{ taxRate: string }[]>`
      SELECT "taxRate"::text FROM "Business" WHERE id = ${ctx.session.user.businessId}
    `.catch(() => [{ taxRate: "0.18" }])
    const taxRate = Number(taxRateRaw[0]?.taxRate ?? 0.18)

    // Validate per-branch stock availability
    const productMap = new Map<string, { name: string; stock: number; costPrice: number | null }>()
    for (const item of items) {
      const product = await prisma.product.findFirst({
        where:  { id: item.productId, businessId: ctx.session.user.businessId },
        select: { name: true, costPrice: true },
      })
      if (!product) {
        return NextResponse.json({ error: `Product not found: ${item.productId}` }, { status: 400 })
      }
      const inventory = await prisma.branchInventory.findUnique({
        where: { branchId_productId: { branchId, productId: item.productId } },
      })
      const availableStock = inventory?.stock ?? 0
      if (availableStock < item.quantity) {
        return NextResponse.json(
          { error: `Insufficient stock for "${product.name}" at ${branch.name}. Available: ${availableStock}, requested: ${item.quantity}.` },
          { status: 400 }
        )
      }
      productMap.set(item.productId, {
        name:      product.name,
        stock:     availableStock,
        costPrice: product.costPrice !== null ? Number(product.costPrice) : null,
      })
    }

    function computeDueDate(terms: string): Date | null {
      const days: Record<string, number> = { COD: 0, NET_7: 7, NET_14: 14, NET_30: 30, NET_60: 60 }
      const d = days[terms]
      if (d === undefined || d === 0) return null
      const date = new Date()
      date.setDate(date.getDate() + d)
      return date
    }
    const dueDate = computeDueDate(paymentTerms)

    // Generate branch-scoped order number: ORD-{CODE}-{YEAR}-{SEQ}
    const year = new Date().getFullYear()
    let orderNumber = ""
    for (let attempt = 0; attempt < 10; attempt++) {
      const count = await prisma.order.count({ where: { branchId } })
      const candidate = `ORD-${branch.code}-${year}-${String(count + 1 + attempt).padStart(4, "0")}`
      const exists = await prisma.order.findFirst({ where: { orderNumber: candidate, branchId } })
      if (!exists) { orderNumber = candidate; break }
    }
    if (!orderNumber) {
      orderNumber = `ORD-${branch.code}-${year}-${Date.now().toString(36).toUpperCase()}`
    }

    const subtotal    = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
    const taxAmount   = Math.round(subtotal * taxRate * 100) / 100
    const totalAmount = subtotal + taxAmount

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          customerName:  customerName.trim(),
          customerPhone: customerPhone ?? null,
          customerId:    customerId    ?? null,
          notes:         notes         ?? null,
          paymentTerms,
          dueDate,
          subtotal,
          taxRate,
          taxAmount,
          totalAmount,
          status:     "PENDING",
          businessId: ctx.session.user.businessId,
          branchId,
          userId:     ctx.session.user.id,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity:  item.quantity,
              unitPrice: item.unitPrice,
              costPrice: productMap.get(item.productId)?.costPrice ?? null,
            })),
          },
        },
        include: {
          items:  { include: { product: true } },
          user:   { select: { name: true } },
          branch: { select: { name: true, code: true } },
        },
      })
      return newOrder
    })

    const business = await prisma.business.findUnique({
      where:  { id: ctx.session.user.businessId },
      select: { name: true, email: true },
    }).catch(() => null)

    createNotification(
      ctx.session.user.businessId,
      "NEW_ORDER",
      `New Order — ${orderNumber}`,
      `${customerName} · RWF ${totalAmount.toLocaleString()}`,
      "/orders",
      branchId,
    )

    if (business?.email) {
      sendOrderConfirmation({
        to:           business.email,
        businessName: business.name,
        orderNumber,
        customerName: order.customerName,
        items:        order.items.map(i => ({
          name:      i.product.name,
          quantity:  i.quantity,
          unitPrice: Number(i.unitPrice),
        })),
        totalAmount,
      }).catch(() => {})
    }

    createAuditLog({
      businessId: ctx.session.user.businessId,
      branchId,
      userId:     ctx.session.user.id,
      action:     "ORDER_CREATED",
      entityType: "Order",
      entityId:   order.id,
      metadata:   { orderNumber, customerName: order.customerName, totalAmount, branchName: branch.name },
      ipAddress:  getIp(request),
    })

    const noCostPrice = items
      .filter(i => productMap.get(i.productId)?.costPrice === null)
      .map(i => productMap.get(i.productId)!.name)

    const responseBody = serialize(order) as Record<string, unknown>
    if (noCostPrice.length > 0) {
      responseBody.warnings = [
        `COGS will be incomplete: ${noCostPrice.join(", ")} ${noCostPrice.length === 1 ? "has" : "have"} no cost price set.`,
      ]
    }

    return NextResponse.json(responseBody, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 })
  }
}
