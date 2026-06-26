import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CreatePaymentSchema } from "@/lib/validators"
import { serialize } from "@/lib/serialize"
import { createNotification } from "@/lib/notify"
import { createAuditLog } from "@/lib/audit"
import { getIp } from "@/lib/rate-limit"

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

    const payment = await prisma.$transaction(async (tx) => {
      const newPayment = await tx.payment.create({
        data: {
          orderId,
          amount,
          method,
          reference: reference ?? null,
          notes:     notes     ?? null,
        },
      })
      await tx.order.update({
        where: { id: orderId },
        data:  { amountPaid: newAmountPaid, paymentStatus },
      })
      // AR: reduce customer.outstandingBalance by payment amount (delivered orders with a customer only)
      if (order.customerId && order.status === "DELIVERED") {
        await tx.customer.update({
          where: { id: order.customerId },
          data:  { outstandingBalance: { decrement: amount } },
        })
      }
      return newPayment
    })

    createNotification(
      session.user.businessId,
      "PAYMENT_RECEIVED",
      `Payment Received — ${order.orderNumber}`,
      `RWF ${amount.toLocaleString()} via ${method.replace("_", " ")} · Status: ${paymentStatus}`,
      "/orders",
    )

    createAuditLog({
      businessId: session.user.businessId,
      userId:     session.user.id,
      action:     "PAYMENT_RECORDED",
      entityType: "Payment",
      entityId:   payment.id,
      metadata:   { orderNumber: order.orderNumber, amount, method, paymentStatus },
      ipAddress:  getIp(request),
    })

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
