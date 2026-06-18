import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CreatePaymentSchema } from "@/lib/validators"
import { serialize } from "@/lib/serialize"

// POST /api/payments — record a payment against an order
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!["OWNER", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const body   = await request.json()
    const parsed = CreatePaymentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { orderId, amount, method, reference, notes } = parsed.data

    // Verify order belongs to this business
    const order = await prisma.order.findFirst({
      where: { id: orderId, businessId: session.user.businessId },
    })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

    if (order.status === "CANCELLED") {
      return NextResponse.json({ error: "Cannot record payment for a cancelled order" }, { status: 400 })
    }

    const newAmountPaid = Number(order.amountPaid) + amount
    const total         = Number(order.totalAmount)

    let paymentStatus: "UNPAID" | "PARTIAL" | "PAID" = "UNPAID"
    if (newAmountPaid >= total) paymentStatus = "PAID"
    else if (newAmountPaid > 0) paymentStatus = "PARTIAL"

    const [payment] = await prisma.$transaction([
      prisma.payment.create({
        data: {
          orderId,
          amount,
          method,
          reference: reference ?? null,
          notes:     notes     ?? null,
        },
      }),
      prisma.order.update({
        where: { id: orderId },
        data: {
          amountPaid:    newAmountPaid,
          paymentStatus,
        },
      }),
    ])

    return NextResponse.json(serialize(payment), { status: 201 })

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to record payment" }, { status: 500 })
  }
}

// GET /api/payments?orderId=xxx — list payments for an order
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const orderId = request.nextUrl.searchParams.get("orderId")
    if (!orderId) return NextResponse.json({ error: "orderId is required" }, { status: 400 })

    const order = await prisma.order.findFirst({
      where: { id: orderId, businessId: session.user.businessId },
    })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

    const payments = await prisma.payment.findMany({
      where:   { orderId },
      orderBy: { paidAt: "desc" },
    })

    return NextResponse.json(serialize(payments))

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 })
  }
}
