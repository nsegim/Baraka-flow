"use client"

import { signOut } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { ShieldOff, LogOut, Mail } from "lucide-react"
import { Suspense } from "react"

function SuspendedContent() {
  const params = useSearchParams()
  const reason = params.get("reason") || ""

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-red-100 overflow-hidden">
        <div className="bg-red-500 px-6 py-8 flex flex-col items-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4">
            <ShieldOff size={32} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-white text-center">Account Suspended</h1>
          <p className="text-red-100 text-sm text-center mt-2">Your business account has been suspended</p>
        </div>

        <div className="px-6 py-6 space-y-4">
          {reason && (
            <div className="p-4 bg-red-50 rounded-xl border border-red-200">
              <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">Reason</p>
              <p className="text-sm text-red-800">{reason}</p>
            </div>
          )}

          <p className="text-sm text-gray-600 text-center">
            If you believe this is a mistake, please contact our support team to resolve the issue.
          </p>

          <a
            href="mailto:support@barakaflow.com"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Mail size={15} />
            Contact Support
          </a>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
          >
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SuspendedPage() {
  return (
    <Suspense>
      <SuspendedContent />
    </Suspense>
  )
}
