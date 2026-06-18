import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CreateOrderSchema } from "@/lib/validators"
import { serialize } from "@/lib/serialize"
import { sendOrderConfirmation } from "@/lib/email"

// GET /api/orders — paginated
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1"))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50")))
    const skip  = (page - 1) * limit

    const where = { businessId: session.user.businessId }

    const [orders, total] = await prisma.$transaction([
      prisma.order.findMany({
        where,
        include: {
          items:    { include: { product: true } },
          user:     { select: { name: true } },
          payments: { orderBy: { paidAt: "desc" } },
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
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["OWNER", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "You do not have permission to create orders" },
        { status: 403 }
      )
    }

    const body   = await request.json()
    const parsed = CreateOrderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { customerName, customerPhone, notes, items } = parsed.data

    // Fetch business tax rate — raw SQL with fallback until migration runs
    const taxRateRaw = await prisma.$queryRaw<{ taxRate: string }[]>`
      SELECT "taxRate"::text FROM "Business" WHERE id = ${session.user.businessId}
    `.catch(() => [{ taxRate: "0.18" }])
    const taxRate = Number(taxRateRaw[0]?.taxRate ?? 0.18)

    // Validate stock availability for every item before touching the DB
    for (const item of items) {
      const product = await prisma.product.findFirst({
        where: { id: item.productId, businessId: session.user.businessId },
      })

      if (!product) {
        return NextResponse.json(
          { error: `Product not found: ${item.productId}` },
          { status: 400 }
        )
      }

      if (product.stock < item.quantity) {
        return NextResponse.json(
          {
            error: `Insufficient stock for "${product.name}". Available: ${product.stock}, requested: ${item.quantity}.`,
          },
          { status: 400 }
        )
      }
    }

    // Generate a collision-safe order number using a retry loop.
    // The count-based approach races when two orders are created simultaneously.
    const year = new Date().getFullYear()
    let orderNumber = ""
    for (let attempt = 0; attempt < 10; attempt++) {
      const count = await prisma.order.count({
        where: { businessId: session.user.businessId },
      })
      const candidate = `ORD-${year}-${String(count + 1 + attempt).padStart(4, "0")}`
      const exists = await prisma.order.findUnique({ where: { orderNumber: candidate } })
      if (!exists) {
        orderNumber = candidate
        break
      }
    }

    if (!orderNumber) {
      // Absolute fallback — should never be reached in normal usage
      orderNumber = `ORD-${year}-${Date.now().toString(36).toUpperCase()}`
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
          notes:         notes         ?? null,
          subtotal,
          taxRate,
          taxAmount,
          totalAmount,
          status:        "PENDING",
          businessId:    session.user.businessId,
          userId:        session.user.id,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity:  item.quantity,
              unitPrice: item.unitPrice,
            })),
          },
        },
        include: {
          items: { include: { product: true } },
          user:  { select: { name: true } },
        },
      })

      return newOrder
    })

    // Send order confirmation — fire-and-forget, never blocks the response
    const business = await prisma.business.findUnique({
      where:  { id: session.user.businessId },
      select: { name: true, email: true },
    }).catch(() => null)

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
      }).catch(() => {}) // email failure must never break order creation
    }

    return NextResponse.json(serialize(order), { status: 201 })

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 })
  }
}
