"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function LoginPage() {
  const router = useRouter()

  // Form field values
  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")

  // UI states
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading,    setIsLoading]    = useState(false)
  const [error,        setError]        = useState("")

  async function handleSubmit(e: React.FormEvent) {
    // Prevent browser's default form behavior
    // (default would reload the page — we don't want that)
    e.preventDefault()

    // Clear any previous error
    setError("")
    setIsLoading(true)

    try {
      // signIn() is from NextAuth
      // "credentials" = use our email/password provider
      // redirect: false = don't redirect automatically, we handle it
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        // Wrong email or password
        setError("Invalid email or password. Please try again.")
        return
      }

      // Success — go to dashboard
      router.push("/dashboard")
      router.refresh() // refresh server components with new session

    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      // Always stop loading whether success or fail
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">

      {/* ── LOGO ── */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-3">
          <Image
            src="/logo.png"
            alt="BarakaFlow"
            width={48}
            height={48}
            className="rounded-xl"
          />
          <h1 className="text-3xl font-bold text-baraka-dark">
            Baraka<span className="text-baraka-primary">Flow</span>
          </h1>
        </div>
        <p className="text-sm text-baraka-sage">
          Manage Sales. Optimize Flow. Grow with Baraka.
        </p>
      </div>

      {/* ── CARD ── */}
      <div className="
        bg-white rounded-2xl
        shadow-lg border border-baraka-sage/20
        p-8
      ">

        {/* Card header */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-baraka-dark">
            Welcome back
          </h2>
          <p className="text-sm text-baraka-sage mt-1">
            Sign in to your account to continue
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="
            mb-4 p-3 rounded-lg
            bg-red-50 border border-red-200
            text-red-600 text-sm
          ">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Email field */}
          <div>
            <label className="
              block text-sm font-medium
              text-baraka-dark mb-1.5
            ">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="
                w-full px-3 py-2.5 rounded-lg
                border border-baraka-sage/40
                bg-baraka-cream/50
                text-baraka-dark text-sm
                placeholder:text-baraka-sage
                outline-none
                focus:border-baraka-primary
                focus:ring-2 focus:ring-baraka-primary/20
                transition-colors
              "
            />
          </div>

          {/* Password field */}
          <div>
            <label className="
              block text-sm font-medium
              text-baraka-dark mb-1.5
            ">
              Password
            </label>
            {/* Wrapper div for input + eye icon */}
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="
                  w-full px-3 py-2.5 rounded-lg
                  border border-baraka-sage/40
                  bg-baraka-cream/50
                  text-baraka-dark text-sm
                  placeholder:text-baraka-sage
                  outline-none
                  focus:border-baraka-primary
                  focus:ring-2 focus:ring-baraka-primary/20
                  transition-colors
                  pr-10
                "
              />
              {/* Toggle password visibility */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="
                  absolute right-3 top-1/2 -translate-y-1/2
                  text-baraka-sage hover:text-baraka-dark
                  transition-colors
                "
              >
                {showPassword
                  ? <EyeOff size={16} />
                  : <Eye size={16} />
                }
              </button>
            </div>
          </div>

          {/* Submit button */}
          <Button
            type="submit"
            disabled={isLoading}
            className="
              w-full py-2.5
              bg-baraka-primary hover:bg-baraka-dark
              text-white font-medium
              rounded-lg transition-colors
              disabled:opacity-50
            "
          >
            {isLoading ? (
              // Spinner while loading
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Signing in...
              </span>
            ) : (
              "Sign In to BarakaFlow"
            )}
          </Button>

        </form>

        {/* Footer link */}
        <p className="text-center text-sm text-baraka-sage mt-6">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="text-baraka-primary hover:text-baraka-dark font-medium transition-colors"
          >
            Create one free
          </Link>
        </p>

      </div>

      {/* Bottom note */}
      <p className="text-center text-xs text-baraka-sage/60 mt-6">
        Built for furniture businesses in Rwanda 🇷🇼
      </p>
    </div>
  )
}