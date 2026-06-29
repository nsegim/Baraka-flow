"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"

// Flutterwave redirects here after payment with ?status=successful&tx_ref=...&transaction_id=...
export default function BillingCallbackPage() {
  const params  = useSearchParams()
  const router  = useRouter()
  const status  = params.get("status")
  const [verifying, setVerifying] = useState(status === "successful")

  useEffect(() => {
    if (status !== "successful") return

    // Give webhook 3 seconds to process, then reload plan usage
    const timer = setTimeout(() => {
      setVerifying(false)
    }, 3000)

    return () => clearTimeout(timer)
  }, [status])

  if (verifying) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 size={40} className="animate-spin text-baraka-primary" />
        <p className="text-lg font-semibold text-[var(--foreground)]">Activating your plan…</p>
        <p className="text-sm text-[var(--muted)]">This takes just a moment.</p>
      </div>
    )
  }

  if (status === "successful") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <CheckCircle size={52} className="text-emerald-500" />
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Subscription Activated!</h1>
        <p className="text-sm text-[var(--muted)]">Your plan is now active. Enjoy BarakaFlow.</p>
        <button
          onClick={() => router.push("/dashboard")}
          className="mt-2 px-6 py-2.5 rounded-lg bg-baraka-primary text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Go to Dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <XCircle size={52} className="text-red-500" />
      <h1 className="text-2xl font-bold text-[var(--foreground)]">Payment Cancelled</h1>
      <p className="text-sm text-[var(--muted)]">No charge was made. You can try again anytime.</p>
      <button
        onClick={() => router.push("/billing")}
        className="mt-2 px-6 py-2.5 rounded-lg bg-baraka-primary text-white text-sm font-medium hover:opacity-90 transition-opacity"
      >
        View Plans
      </button>
    </div>
  )
}
