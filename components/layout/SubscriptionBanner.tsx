"use client"

import { useState, useEffect } from "react"
import { AlertTriangle, CrownIcon, X } from "lucide-react"
import Link from "next/link"

interface PlanUsage {
  subscriptionStatus: string
  trialEndsAt:   string | null
  planExpiresAt: string | null
  planName:      string | null
}

export default function SubscriptionBanner() {
  const [data,       setData]       = useState<PlanUsage | null>(null)
  const [dismissed,  setDismissed]  = useState(false)

  useEffect(() => {
    fetch("/api/plan-usage")
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .catch(() => {})
  }, [])

  if (!data || dismissed) return null

  const status = data.subscriptionStatus

  // Days until trial ends
  const trialDaysLeft = data.trialEndsAt
    ? Math.ceil((new Date(data.trialEndsAt).getTime() - Date.now()) / 86400000)
    : null

  // Days until plan expires
  const expiryDaysLeft = data.planExpiresAt
    ? Math.ceil((new Date(data.planExpiresAt).getTime() - Date.now()) / 86400000)
    : null

  // Decide what to show
  let banner: { bg: string; text: string; message: string; cta?: string } | null = null

  if (status === "SUSPENDED") {
    banner = {
      bg:      "bg-red-600",
      text:    "text-white",
      message: "Your account is suspended. Contact support to reactivate.",
      cta:     undefined,
    }
  } else if (status === "EXPIRED" || status === "CANCELLED") {
    banner = {
      bg:      "bg-red-500",
      text:    "text-white",
      message: "Your subscription has expired. Renew now to continue using BarakaFlow.",
      cta:     "Renew Plan",
    }
  } else if (status === "TRIAL" && trialDaysLeft !== null && trialDaysLeft <= 7) {
    banner = {
      bg:      trialDaysLeft <= 2 ? "bg-red-500" : "bg-amber-500",
      text:    "text-white",
      message: trialDaysLeft <= 0
        ? "Your trial has ended. Subscribe to keep access."
        : `Your free trial ends in ${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""}. Subscribe to avoid losing access.`,
      cta: "View Plans",
    }
  } else if (status === "ACTIVE" && expiryDaysLeft !== null && expiryDaysLeft <= 7) {
    banner = {
      bg:      expiryDaysLeft <= 2 ? "bg-red-500" : "bg-amber-500",
      text:    "text-white",
      message: `Your ${data.planName ?? ""} plan expires in ${expiryDaysLeft} day${expiryDaysLeft !== 1 ? "s" : ""}. Renew to stay active.`,
      cta:     "Renew Plan",
    }
  }

  if (!banner) return null

  return (
    <div className={`${banner.bg} ${banner.text} px-4 py-2.5 flex items-center justify-between gap-3 text-sm`}>
      <div className="flex items-center gap-2">
        <AlertTriangle size={15} className="shrink-0" />
        <span>{banner.message}</span>
        {banner.cta && (
          <Link
            href="/billing"
            className="ml-2 underline underline-offset-2 font-semibold hover:no-underline flex items-center gap-1"
          >
            <CrownIcon size={13} />
            {banner.cta}
          </Link>
        )}
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="p-1 rounded hover:bg-white/20 transition-colors shrink-0"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  )
}
