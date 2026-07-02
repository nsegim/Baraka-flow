"use client"

import { useState, useEffect } from "react"
import { CrownIcon, Check, Loader2, RefreshCw } from "lucide-react"

interface Plan {
  id: string; name: string; slug: string; description: string | null
  price: number; currency: string
  maxUsers: number | null; maxProducts: number | null
  maxOrders: number | null; maxBranches: number | null
  features: Record<string, boolean>
  isActive: boolean; isPublic: boolean
}

interface CurrentPlan {
  planName: string | null; planSlug: string | null
  subscriptionStatus: string
  trialEndsAt: string | null; planExpiresAt: string | null
}

function fmt(n: number | null) { return n == null ? "Unlimited" : n.toLocaleString() }

export default function BillingPage() {
  const [plans,       setPlans]       = useState<Plan[]>([])
  const [current,     setCurrent]     = useState<CurrentPlan | null>(null)
  const [loadingId,   setLoadingId]   = useState<string | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState("")

  useEffect(() => {
    Promise.all([
      fetch("/api/plans").then(r => r.json()),
      fetch("/api/plan-usage").then(r => r.json()),
    ]).then(([plansData, usageData]) => {
      setPlans(Array.isArray(plansData) ? plansData : [])
      setCurrent(usageData)
      setLoading(false)
    }).catch(() => { setError("Failed to load plans"); setLoading(false) })
  }, [])

  async function handleSubscribe(plan: Plan) {
    if (plan.price === 0) return
    setLoadingId(plan.id); setError("")
    const res  = await fetch("/api/billing/initiate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: plan.id }),
    })
    const data = await res.json()
    setLoadingId(null)
    if (!res.ok) { setError(data.error || "Failed to start payment"); return }
    // Redirect to Flutterwave checkout
    window.location.href = data.paymentLink
  }

  const isCurrent = (plan: Plan) => current?.planSlug === plan.slug && current?.subscriptionStatus === "ACTIVE"

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw size={20} className="animate-spin text-[var(--muted)]" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl space-y-8">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <CrownIcon size={20} className="text-baraka-primary" />
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Subscription Plans</h1>
        </div>
        <p className="text-sm text-[var(--muted)]">
          {current?.planName
            ? `Currently on ${current.planName} plan (${current.subscriptionStatus})`
            : "Choose a plan to unlock your business's full potential"}
        </p>
        {current?.planExpiresAt && (
          <p className="text-xs text-amber-600 mt-1">
            Plan renews on {new Date(current.planExpiresAt).toLocaleDateString("en-RW", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        )}
        {current?.trialEndsAt && current.subscriptionStatus === "TRIAL" && (
          <p className="text-xs text-amber-600 mt-1">
            Trial ends {new Date(current.trialEndsAt).toLocaleDateString("en-RW", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}

      {/* Plan cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map(plan => {
          const active  = isCurrent(plan)
          const isFree  = plan.price === 0

          return (
            <div
              key={plan.id}
              className={`rounded-2xl border-2 p-6 flex flex-col gap-5 transition-shadow ${
                active
                  ? "border-baraka-primary bg-baraka-primary/5 shadow-lg"
                  : "border-[var(--border)] bg-[var(--card)]"
              }`}
            >
              {/* Plan name + price */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-lg font-bold text-[var(--foreground)]">{plan.name}</h2>
                  {active && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-baraka-primary text-white font-medium">Current</span>
                  )}
                </div>
                <div className="flex items-end gap-1">
                  <span className="text-3xl font-extrabold text-[var(--foreground)]">
                    {isFree ? "Free" : `${plan.currency} ${Number(plan.price).toLocaleString()}`}
                  </span>
                  {!isFree && <span className="text-sm text-[var(--muted)] mb-1">/month</span>}
                </div>
                {plan.description && <p className="text-sm text-[var(--muted)] mt-2">{plan.description}</p>}
              </div>

              {/* Limits */}
              <ul className="space-y-2 text-sm text-[var(--foreground)]">
                {[
                  { label: "Users",    value: fmt(plan.maxUsers)    },
                  { label: "Products", value: fmt(plan.maxProducts) },
                  { label: "Orders",   value: fmt(plan.maxOrders)   },
                  { label: "Branches", value: fmt(plan.maxBranches) },
                ].map(row => (
                  <li key={row.label} className="flex items-center justify-between">
                    <span className="text-[var(--muted)]">{row.label}</span>
                    <span className="font-semibold">{row.value}</span>
                  </li>
                ))}
              </ul>

              {/* Features */}
              {Object.entries(plan.features ?? {}).length > 0 && (
                <ul className="space-y-1.5 text-sm border-t border-[var(--border)] pt-4">
                  {Object.entries(plan.features).map(([key, enabled]) => (
                    <li key={key} className={`flex items-center gap-2 ${enabled ? "text-[var(--foreground)]" : "text-[var(--muted)] line-through"}`}>
                      <Check size={13} className={enabled ? "text-emerald-500" : "text-[var(--muted)]"} />
                      {key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}
                    </li>
                  ))}
                </ul>
              )}

              {/* CTA */}
              <div className="mt-auto">
                {isFree ? (
                  <p className="text-center text-sm text-[var(--muted)] py-2">No payment required</p>
                ) : active ? (
                  <button disabled className="w-full py-2.5 rounded-xl bg-baraka-primary/20 text-baraka-primary text-sm font-medium cursor-default">
                    ✓ Active Plan
                  </button>
                ) : (
                  <button
                    onClick={() => handleSubscribe(plan)}
                    disabled={loadingId === plan.id}
                    className="w-full py-2.5 rounded-xl bg-baraka-primary hover:opacity-90 text-white text-sm font-semibold transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loadingId === plan.id ? <><Loader2 size={14} className="animate-spin" /> Processing…</> : `Subscribe — ${plan.currency} ${Number(plan.price).toLocaleString()}/mo`}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Support note */}
      <p className="text-xs text-center text-[var(--muted)] pb-4">
        Payments are processed securely via Flutterwave. Cancel anytime by contacting support.
      </p>
    </div>
  )
}
