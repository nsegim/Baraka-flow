import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getBusinessPlan, getBusinessUsage } from "@/lib/plan-limits"
import { serialize } from "@/lib/serialize"

// GET /api/plan-usage — current plan info + usage counts for the session's business
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const businessId = session.user.businessId
  const [planInfo, usage] = await Promise.all([
    getBusinessPlan(businessId),
    getBusinessUsage(businessId),
  ])

  if (!planInfo) return NextResponse.json({ error: "Business not found" }, { status: 404 })

  // Resolve effective limits (business override → plan limit → null)
  function effectiveLimit(bizVal: number | null, planVal: number | null | undefined): number | null {
    if (bizVal !== null && bizVal !== undefined) return bizVal
    if (planVal !== null && planVal !== undefined) return planVal
    return null
  }

  const plan = planInfo.subscriptionPlan

  return NextResponse.json(serialize({
    planName:           plan?.name ?? null,
    planSlug:           plan?.slug ?? null,
    subscriptionStatus: planInfo.subscriptionStatus,
    trialEndsAt:        planInfo.trialEndsAt,
    planExpiresAt:      planInfo.planExpiresAt,
    price:              plan?.price ?? null,
    currency:           plan?.currency ?? null,
    features:           plan?.features ?? {},
    usage,
    limits: {
      users:    effectiveLimit(planInfo.maxUsers,    plan?.maxUsers),
      products: effectiveLimit(planInfo.maxProducts, plan?.maxProducts),
      orders:   effectiveLimit(planInfo.maxOrders,   plan?.maxOrders),
      branches: effectiveLimit(planInfo.maxBranches, plan?.maxBranches),
    },
  }))
}
