import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const Schema = z.object({ planId: z.string() })

// POST /api/billing/initiate — create a Flutterwave payment link for a plan
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Only the account owner can manage billing" }, { status: 403 })
  }

  const body   = await request.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid plan" }, { status: 400 })

  const plan = await prisma.plan.findUnique({ where: { id: parsed.data.planId } })
  if (!plan || !plan.isActive) return NextResponse.json({ error: "Plan not found" }, { status: 404 })
  if (plan.price === 0) return NextResponse.json({ error: "Free plan does not require payment" }, { status: 400 })

  const business = await prisma.business.findUnique({
    where:  { id: session.user.businessId },
    select: { name: true, email: true },
  })
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 })

  const txRef   = `BF-${session.user.businessId}-${plan.id}-${Date.now()}`
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  const payload = {
    tx_ref:          txRef,
    amount:          Number(plan.price),
    currency:        plan.currency,
    redirect_url:    `${appUrl}/billing/callback`,
    customer: {
      email:        business.email,
      name:         business.name,
    },
    customizations: {
      title:        "BarakaFlow Subscription",
      description:  `${plan.name} plan — ${plan.currency} ${Number(plan.price).toLocaleString()}/month`,
      logo:         `${appUrl}/logo.png`,
    },
    meta: {
      businessId: session.user.businessId,
      planId:     plan.id,
    },
  }

  const flwRes = await fetch("https://api.flutterwave.com/v3/payments", {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
    },
    body: JSON.stringify(payload),
  })

  const flwData = await flwRes.json()
  if (flwData.status !== "success") {
    console.error("Flutterwave initiate error:", flwData)
    return NextResponse.json({ error: "Failed to create payment link" }, { status: 502 })
  }

  return NextResponse.json({ paymentLink: flwData.data.link })
}
