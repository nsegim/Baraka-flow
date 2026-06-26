"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Loader2, CheckCircle2, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function ForgotPasswordPage() {
  const [email,     setEmail]     = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error,     setError]     = useState("")
  const [sent,      setSent]      = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email }),
      })
      // Always show success — API never reveals whether email exists
      if (res.status === 429) {
        const d = await res.json()
        setError(d.error)
        return
      }
      setSent(true)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-3">
          <Image src="/logo.png" alt="BarakaFlow" width={48} height={48} className="rounded-xl" />
          <h1 className="text-3xl font-bold text-baraka-dark">
            Baraka<span className="text-baraka-primary">Flow</span>
          </h1>
        </div>
        <p className="text-sm text-baraka-sage">Manage Sales. Optimize Flow. Grow with Baraka.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-baraka-sage/20 p-8">
        {sent ? (
          /* Success state */
          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} className="text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-baraka-dark mb-2">Check your email</h2>
            <p className="text-sm text-baraka-sage mb-6">
              If <strong>{email}</strong> is registered, you&apos;ll receive a reset link within a few minutes.
              Check your spam folder if you don&apos;t see it.
            </p>
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 text-sm text-baraka-primary hover:text-baraka-dark font-medium transition-colors"
            >
              <ArrowLeft size={16} />
              Back to Sign In
            </Link>
          </div>
        ) : (
          /* Form state */
          <>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-baraka-dark">Forgot your password?</h2>
              <p className="text-sm text-baraka-sage mt-1">
                Enter your email and we&apos;ll send you a reset link.
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-baraka-dark mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="
                    w-full px-3 py-2.5 rounded-lg
                    border border-baraka-sage/40 bg-baraka-cream/50
                    text-baraka-dark text-sm placeholder:text-baraka-sage
                    outline-none focus:border-baraka-primary
                    focus:ring-2 focus:ring-baraka-primary/20 transition-colors
                  "
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-baraka-primary hover:bg-baraka-dark text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Sending...
                  </span>
                ) : "Send Reset Link"}
              </Button>
            </form>

            <p className="text-center text-sm text-baraka-sage mt-6">
              Remember it?{" "}
              <Link href="/login" className="text-baraka-primary hover:text-baraka-dark font-medium transition-colors">
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
