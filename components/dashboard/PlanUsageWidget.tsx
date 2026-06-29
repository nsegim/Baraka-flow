"use client"

import { useState, useEffect } from "react"
import { CrownIcon, Users, Package, ShoppingCart, GitBranch, AlertTriangle } from "lucide-react"

interface PlanUsage {
  planName:           string | null
  planSlug:           string | null
  subscriptionStatus: string
  trialEndsAt:        string | null
  planExpiresAt:      string | null
  price:              number | null
  currency:           string | null
  usage:   { users: number; products: number; orders: number; branches: number }
  limits:  { users: number | null; products: number | null; orders: number | null; branches: number | null }
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE:    "text-emerald-600 bg-emerald-50 border-emerald-200",
  TRIAL:     "text-amber-600 bg-amber-50 border-amber-200",
  SUSPENDED: "text-red-600 bg-red-50 border-red-200",
  EXPIRED:   "text-gray-500 bg-gray-100 border-gray-200",
  CANCELLED: "text-gray-500 bg-gray-100 border-gray-200",
}

function UsageBar({ label, icon: Icon, used, limit }: { label: string; icon: React.ElementType; used: number; limit: number | null }) {
  const pct    = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0
  const warn   = limit && pct >= 80
  const exceed = limit && pct >= 100

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-[var(--muted)]">
          <Icon size={12} />
          {label}
        </span>
        <span className={`font-medium ${exceed ? "text-red-500" : warn ? "text-amber-500" : "text-[var(--foreground)]"}`}>
          {used}{limit ? `/${limit}` : ""}
          {!limit && <span className="text-[var(--muted)] font-normal ml-0.5">(unlimited)</span>}
        </span>
      </div>
      {limit && (
        <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${exceed ? "bg-red-500" : warn ? "bg-amber-400" : "bg-emerald-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}

export default function PlanUsageWidget() {
  const [data,    setData]    = useState<PlanUsage | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/plan-usage")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading || !data) return null

  const status     = data.subscriptionStatus || "TRIAL"
  const statusCls  = STATUS_COLOR[status] ?? STATUS_COLOR.TRIAL
  const planLabel  = data.planName ?? "Trial"

  const trialDaysLeft = data.trialEndsAt
    ? Math.ceil((new Date(data.trialEndsAt).getTime() - Date.now()) / 86400000)
    : null

  const expiring = data.planExpiresAt
    ? Math.ceil((new Date(data.planExpiresAt).getTime() - Date.now()) / 86400000)
    : null

  return (
    <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
            <CrownIcon size={15} className="text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">{planLabel}</p>
            <p className="text-xs text-[var(--muted)]">
              {data.price != null && data.price > 0 ? `${data.currency} ${data.price.toLocaleString()}/mo` : "Free"}
            </p>
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusCls}`}>{status}</span>
      </div>

      {/* Alerts */}
      {status === "TRIAL" && trialDaysLeft !== null && trialDaysLeft <= 7 && (
        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle size={12} />
          Trial ends in {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""}
        </div>
      )}
      {expiring !== null && expiring <= 14 && expiring > 0 && (
        <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
          <AlertTriangle size={12} />
          Plan expires in {expiring} day{expiring !== 1 ? "s" : ""}
        </div>
      )}

      {/* Usage bars */}
      <div className="space-y-3">
        <UsageBar label="Users"    icon={Users}        used={data.usage.users}    limit={data.limits.users} />
        <UsageBar label="Products" icon={Package}      used={data.usage.products} limit={data.limits.products} />
        <UsageBar label="Orders"   icon={ShoppingCart} used={data.usage.orders}   limit={data.limits.orders} />
        <UsageBar label="Branches" icon={GitBranch}    used={data.usage.branches} limit={data.limits.branches} />
      </div>
    </div>
  )
}
