"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react"

export default function AdminLoginPage() {
  const router = useRouter()

  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [showPwd,  setShowPwd]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const result = await signIn("platform", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError("Invalid credentials or account is inactive.")
        return
      }

      router.push("/admin")
      router.refresh()
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const inp = `
    w-full px-3 py-2.5 rounded-lg
    border border-gray-700 bg-gray-800
    text-white text-sm placeholder:text-gray-500
    outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500
    transition-colors
  `

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/30 mb-4">
            <ShieldCheck size={28} className="text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-white">BarakaFlow Control Room</h1>
          <p className="text-sm text-gray-500 mt-1">Platform administration access</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-7 space-y-5">

          {error && (
            <div className="px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Platform Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@barakaflow.rw"
                required
                autoComplete="username"
                className={inp}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  autoComplete="current-password"
                  className={`${inp} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <><Loader2 size={15} className="animate-spin" /> Signing in…</>
              ) : (
                "Sign In to Admin Console"
              )}
            </button>
          </form>

          <p className="text-center text-xs text-gray-600">
            This area is restricted to Baraka Flow platform staff only.
          </p>
        </div>

        <p className="text-center text-xs text-gray-700 mt-6">
          Looking for tenant login?{" "}
          <a href="/login" className="text-gray-500 hover:text-gray-400 transition-colors underline">
            Go to app login
          </a>
        </p>
      </div>
    </div>
  )
}
