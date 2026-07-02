import { prisma }                          from "@/lib/prisma"
import { cache, TTL, planLimitsKey }       from "@/lib/cache"

export type PlanResource = "users" | "products" | "orders" | "branches"

export interface LimitCheckResult {
  allowed:  boolean
  error?:   string
  current?: number
  limit?:   number
}

// ── Shared business+plan select fragment ────────────────────────────────────
const bizPlanSelect = {
  maxUsers:    true,
  maxProducts: true,
  maxOrders:   true,
  maxBranches: true,
  subscriptionPlan: {
    select: {
      name:        true,
      maxUsers:    true,
      maxProducts: true,
      maxOrders:   true,
      maxBranches: true,
      features:    true,
    },
  },
} as const

// ── checkPlanLimit ───────────────────────────────────────────────────────────
// Call BEFORE creating a new user / product / order / branch.
// Business-level overrides (maxUsers, maxProducts …) take precedence over the
// plan's limits. null on either side means "unlimited".
export async function checkPlanLimit(
  businessId: string,
  resource:   PlanResource,
): Promise<LimitCheckResult> {
  const cacheKey = planLimitsKey(businessId)
  let biz = cache.get<Awaited<ReturnType<typeof fetchBizPlan>>>(cacheKey)

  if (!biz) {
    biz = await fetchBizPlan(businessId)
    if (biz) cache.set(cacheKey, biz, TTL.planLimits)
  }

  if (!biz) return { allowed: false, error: "Business not found" }

  // Per-business override wins; fall back to plan limit; null = unlimited
  const effectiveLimit = resolveLimit(biz, resource)

  if (effectiveLimit === null) return { allowed: true }

  const current = await countResource(businessId, resource)

  if (current >= effectiveLimit) {
    const planName = biz.subscriptionPlan?.name ?? "your current plan"
    return {
      allowed: false,
      current,
      limit:   effectiveLimit,
      error:   `${capitalize(resource)} limit reached (${current}/${effectiveLimit}). ` +
               `Upgrade ${planName} to add more ${resource}.`,
    }
  }

  return { allowed: true, current, limit: effectiveLimit }
}

// ── hasFeature ───────────────────────────────────────────────────────────────
// Check whether the business's plan includes a named feature flag.
export async function hasFeature(businessId: string, feature: string): Promise<boolean> {
  const biz = await prisma.business.findUnique({
    where:  { id: businessId },
    select: { subscriptionPlan: { select: { features: true } } },
  })

  const features = biz?.subscriptionPlan?.features
  if (!features || typeof features !== "object") return false

  return (features as Record<string, boolean>)[feature] === true
}

// ── getBusinessPlan ──────────────────────────────────────────────────────────
// Returns the Plan record attached to this business, or null.
export async function getBusinessPlan(businessId: string) {
  const biz = await prisma.business.findUnique({
    where:  { id: businessId },
    select: {
      subscriptionStatus: true,
      trialEndsAt:        true,
      planExpiresAt:      true,
      subscriptionPlan:   { select: { id: true, name: true, slug: true, maxUsers: true, maxProducts: true, maxOrders: true, maxBranches: true, features: true, price: true, currency: true } },
      maxUsers:           true,
      maxProducts:        true,
      maxOrders:          true,
      maxBranches:        true,
    },
  })
  return biz ?? null
}

// ── getBusinessUsage ─────────────────────────────────────────────────────────
// Returns current counts for all resources in a single round-trip.
export async function getBusinessUsage(businessId: string) {
  const [users, products, orders, branches] = await Promise.all([
    prisma.user.count({   where: { businessId } }),
    prisma.product.count({ where: { businessId } }),
    prisma.order.count({   where: { businessId } }),
    prisma.branch.count({  where: { businessId, isActive: true } }),
  ])
  return { users, products, orders, branches }
}

// ── invalidatePlanCache ───────────────────────────────────────────────────────
// Call after assigning or changing a plan so the next limit check re-fetches.
export function invalidatePlanCache(businessId: string): void {
  cache.del(planLimitsKey(businessId))
}

// ── helpers ──────────────────────────────────────────────────────────────────
async function fetchBizPlan(businessId: string) {
  return prisma.business.findUnique({
    where:  { id: businessId },
    select: bizPlanSelect,
  })
}

function resolveLimit(
  biz: {
    maxUsers: number | null; maxProducts: number | null
    maxOrders: number | null; maxBranches: number | null
    subscriptionPlan: {
      maxUsers: number | null; maxProducts: number | null
      maxOrders: number | null; maxBranches: number | null
    } | null
  },
  resource: PlanResource,
): number | null {
  const bizOverride  = biz[`max${capitalize(resource) as "Users" | "Products" | "Orders" | "Branches"}`]
  const planLimit    = biz.subscriptionPlan?.[`max${capitalize(resource) as "Users" | "Products" | "Orders" | "Branches"}`]

  // Business override → plan limit → null (unlimited)
  if (bizOverride  !== null && bizOverride  !== undefined) return bizOverride
  if (planLimit    !== null && planLimit    !== undefined) return planLimit
  return null
}

async function countResource(businessId: string, resource: PlanResource): Promise<number> {
  switch (resource) {
    case "users":    return prisma.user.count({   where: { businessId } })
    case "products": return prisma.product.count({ where: { businessId } })
    case "orders":   return prisma.order.count({   where: { businessId } })
    case "branches": return prisma.branch.count({  where: { businessId, isActive: true } })
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
