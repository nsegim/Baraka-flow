import { NextRequest, NextResponse } from "next/server"
import { prisma }                    from "@/lib/prisma"
import { invalidatePlanCache }        from "@/lib/plan-limits"
import { invalidateSubscriptionCache } from "@/lib/subscription"

// POST /api/billing/webhook — Flutterwave sends payment events here
// Publicly reachable — verified by secret hash, NOT by auth cookie
export async function POST(request: NextRequest) {
  const body = await request.text()

  // Verify the request is genuinely from Flutterwave
  const hash = request.headers.get("verif-hash")
  if (!hash || hash !== process.env.FLUTTERWAVE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let event: Record<string, unknown>
  try {
    event = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Only handle successful charge events
  if (event.event !== "charge.completed") {
    return NextResponse.json({ received: true })
  }

  const data = event.data as Record<string, unknown>
  if (data.status !== "successful") {
    return NextResponse.json({ received: true })
  }

  const txRef      = data.tx_ref as string
  const flwTxId    = String(data.id ?? "")
  const meta       = (data.meta as Record<string, string>) ?? {}
  const businessId = meta.businessId
  const planId     = meta.planId

  if (!businessId || !planId || !txRef) {
    console.error("Webhook missing required fields:", { businessId, planId, txRef })
    return NextResponse.json({ error: "Missing metadata" }, { status: 400 })
  }

  // Idempotency — ignore if we already processed this transaction
  const existing = await prisma.billingTransaction.findUnique({ where: { txRef } })
  if (existing) {
    console.log(`Duplicate webhook ignored: txRef=${txRef}`)
    return NextResponse.json({ received: true })
  }

  // Verify the transaction directly with Flutterwave (prevents replay attacks)
  const verifyRes = await fetch(`https://api.flutterwave.com/v3/transactions/${flwTxId}/verify`, {
    headers: { "Authorization": `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` },
  })
  const verifyData = await verifyRes.json()

  if (
    verifyData.status !== "success"        ||
    verifyData.data?.status !== "successful" ||
    verifyData.data?.meta?.businessId !== businessId ||
    verifyData.data?.meta?.planId     !== planId
  ) {
    console.error("Transaction verification failed:", verifyData)
    return NextResponse.json({ error: "Verification failed" }, { status: 400 })
  }

  const plan = await prisma.plan.findUnique({ where: { id: planId } })
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 })

  const amount        = Number(verifyData.data?.amount ?? data.amount ?? plan.price)
  const planExpiresAt = new Date()
  planExpiresAt.setDate(planExpiresAt.getDate() + 30)

  // Activate subscription + record the transaction atomically
  await prisma.$transaction([
    prisma.business.update({
      where: { id: businessId },
      data: {
        planId,
        subscriptionStatus: "ACTIVE",
        trialEndsAt:        null,
        planExpiresAt,
      },
    }),
    prisma.billingTransaction.create({
      data: {
        businessId,
        planId,
        amount,
        currency: plan.currency,
        txRef,
        flwTxId,
        status:  "success",
        paidAt:  new Date(),
      },
    }),
  ])

  invalidatePlanCache(businessId)
  invalidateSubscriptionCache(businessId)
  console.log(`✓ Plan activated: business=${businessId} plan=${plan.name} txRef=${txRef} expires=${planExpiresAt.toISOString()}`)
  return NextResponse.json({ received: true })
}
