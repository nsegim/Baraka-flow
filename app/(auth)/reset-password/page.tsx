"use client"

import { useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Eye, EyeOff, Loader2, CheckCircle2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

function ResetPasswordForm() {
  const searchParams  = useSearchParams()
  const router        = useRouter()
  const token         = searchParams.get("token") ?? ""

  const [password,     setPassword]     = useState("")
  const [confirm,      setConfirm]      = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading,    setIsLoading]    = useState(false)
  const [error,        setError]        = useState("")
  const [success,      setSuccess]      = useState(false)

  if (!token) {
    return (
      <div className="text-center">
        <AlertTriangle size={40} className="text-red-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-baraka-dark mb-2">Invalid Link</h2>
        <p className="text-sm text-baraka-sage mb-4">
          This password reset link is missing or malformed.
        </p>
        <Link href="/forgot-password" className="text-baraka-primary hover:underline text-sm font-medium">
          Request a new link
        </Link>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (password !== confirm) {
      setError("Passwords do not match.")
      return
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch("/api/auth/reset-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setSuccess(true)
      setTimeout(() => router.push("/login"), 3000)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={32} className="text-emerald-500" />
        </div>
        <h2 className="text-xl font-bold text-baraka-dark mb-2">Password Updated</h2>
        <p className="text-sm text-baraka-sage">
          Your password has been changed successfully. Redirecting to sign in...
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-baraka-dark">Set New Password</h2>
        <p className="text-sm text-baraka-sage mt-1">Choose a strong password for your account.</p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
          {error}
          {(error.includes("expired") || error.includes("already been used")) && (
            <span className="block mt-1">
              <Link href="/forgot-password" className="underline font-medium">Request a new link</Link>
            </span>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-baraka-dark mb-1.5">New Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              className="
                w-full px-3 py-2.5 pr-10 rounded-lg
                border border-baraka-sage/40 bg-baraka-cream/50
                text-baraka-dark text-sm placeholder:text-baraka-sage
                outline-none focus:border-baraka-primary
                focus:ring-2 focus:ring-baraka-primary/20 transition-colors
              "
            />
            <button
              type="button"
              onClick={() => setShowPassword(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-baraka-sage hover:text-baraka-dark transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-baraka-dark mb-1.5">Confirm Password</label>
          <input
            type={showPassword ? "text" : "password"}
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="Repeat your new password"
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
              Updating...
            </span>
          ) : "Update Password"}
        </Button>
      </form>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="w-full max-w-md">
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
        {/* Suspense required because useSearchParams() is a client boundary */}
        <Suspense fallback={<div className="text-center text-sm text-baraka-sage">Loading...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  )
}
