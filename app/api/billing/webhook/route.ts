import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"

// POST /api/billing/webhook — Flutterwave sends payment events here
// Must be publicly reachable (no auth cookie needed — verified by secret hash)
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

  // Extract our metadata from the transaction
  const meta       = (data.meta as Record<string, string>) ?? {}
  const businessId = meta.businessId
  const planId     = meta.planId

  if (!businessId || !planId) {
    console.error("Webhook missing meta:", meta)
    return NextResponse.json({ error: "Missing metadata" }, { status: 400 })
  }

  // Verify the transaction with Flutterwave (prevents replay attacks)
  const txId      = data.id as string
  const verifyRes = await fetch(`https://api.flutterwave.com/v3/transactions/${txId}/verify`, {
    headers: { "Authorization": `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` },
  })
  const verifyData = await verifyRes.json()

  if (
    verifyData.status !== "success" ||
    verifyData.data?.status !== "successful" ||
    verifyData.data?.meta?.businessId !== businessId ||
    verifyData.data?.meta?.planId     !== planId
  ) {
    console.error("Transaction verification failed:", verifyData)
    return NextResponse.json({ error: "Verification failed" }, { status: 400 })
  }

  const plan = await prisma.plan.findUnique({ where: { id: planId } })
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 })

  // Activate the subscription — expires 30 days from now (monthly billing)
  const planExpiresAt = new Date()
  planExpiresAt.setDate(planExpiresAt.getDate() + 30)

  await prisma.business.update({
    where: { id: businessId },
    data: {
      planId,
      subscriptionStatus: "ACTIVE",
      trialEndsAt:        null,
      planExpiresAt,
    },
  })

  console.log(`✓ Plan activated: business=${businessId} plan=${plan.name} expires=${planExpiresAt.toISOString()}`)
  return NextResponse.json({ received: true })
}
