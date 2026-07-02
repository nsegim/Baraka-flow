// Subscription status guard — called before any write operation.
// Cached per-business for 60s so it doesn't hit the DB on every request.

import { prisma }              from "@/lib/prisma"
import { cache, planLimitsKey } from "@/lib/cache"

export type SubscriptionCheckResult =
  | { allowed: true }
  | { allowed: false; status: string; message: string }

// 60-second TTL — short enough to reflect admin changes quickly
const SUB_TTL_MS = 60_000

interface SubState {
  status:       string
  trialEndsAt:  Date | null
  planExpiresAt: Date | null
}

function subKey(businessId: string) {
  return `sub:status:${businessId}`
}

export async function checkSubscription(businessId: string): Promise<SubscriptionCheckResult> {
  let state = cache.get<SubState>(subKey(businessId))

  if (!state) {
    const biz = await prisma.business.findUnique({
      where:  { id: businessId },
      select: { subscriptionStatus: true, trialEndsAt: true, planExpiresAt: true },
    })
    if (!biz) return { allowed: false, status: "UNKNOWN", message: "Business not found" }

    state = {
      status:        biz.subscriptionStatus ?? "TRIAL",
      trialEndsAt:   biz.trialEndsAt,
      planExpiresAt: biz.planExpiresAt,
    }
    cache.set(subKey(businessId), state, SUB_TTL_MS)
  }

  const { status, trialEndsAt, planExpiresAt } = state
  const now = Date.now()

  switch (status) {
    case "SUSPENDED":
      return {
        allowed: false,
        status,
        message: "Your account is suspended. Contact support to reactivate.",
      }

    case "CANCELLED":
    case "EXPIRED":
      return {
        allowed: false,
        status,
        message: "Your subscription has expired. Renew your plan to continue.",
      }

    case "TRIAL":
      if (trialEndsAt && trialEndsAt.getTime() < now) {
        return {
          allowed: false,
          status:  "TRIAL_EXPIRED",
          message: "Your free trial has ended. Subscribe to continue using BarakaFlow.",
        }
      }
      return { allowed: true }

    case "ACTIVE":
      if (planExpiresAt && planExpiresAt.getTime() < now) {
        // Expired but status not yet updated — treat as expired
        return {
          allowed: false,
          status:  "EXPIRED",
          message: "Your subscription has expired. Renew your plan to continue.",
        }
      }
      return { allowed: true }

    default:
      return { allowed: true }
  }
}

/** Invalidate subscription cache after plan change or webhook activation. */
export function invalidateSubscriptionCache(businessId: string): void {
  cache.del(subKey(businessId))
  // Also invalidate plan limits cache (shares businessId key space)
  cache.del(planLimitsKey(businessId))
}
