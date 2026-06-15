"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function RegisterPage() {
  const router = useRouter()

  // All form fields
  const [businessName, setBusinessName] = useState("")
  const [name,         setName]         = useState("")
  const [email,        setEmail]        = useState("")
  const [password,     setPassword]     = useState("")
  const [confirmPass,  setConfirmPass]  = useState("")

  // UI states
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading,    setIsLoading]    = useState(false)
  const [error,        setError]        = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    // Client-side validation before hitting the API
    if (password !== confirmPass) {
      setError("Passwords do not match")
      return
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }

    setIsLoading(true)

    try {
      // 1. Call our registration API
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          businessName,
        }),
      })

      const data = await response.json()

      // console.log("Registration response:", data)

      // 2. If registration failed
      if (!response.ok) {
        setError(data.error || "Registration failed")
        return
      }

      // 3. Registration succeeded — automatically sign them in
      const signInResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (signInResult?.error) {
        // Registration worked but auto-login failed
        // Send them to login page to sign in manually
        router.push("/login")
        return
      }

      // 4. Fully successful — go to dashboard
      router.push("/dashboard")
      router.refresh()

    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
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
          Start managing your inventory the smart way
        </p>
      </div>

      {/* ── CARD ── */}
      <div className="
        bg-white rounded-2xl
        shadow-lg border border-baraka-sage/20
        p-8
      ">

        <div className="mb-6">
          <h2 className="text-xl font-bold text-baraka-dark">
            Create your account
          </h2>
          <p className="text-sm text-baraka-sage mt-1">
            Set up BarakaFlow for your business
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="
            mb-4 p-3 rounded-lg
            bg-red-50 border border-red-200
            text-red-600 text-sm
          ">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Business name */}
          <div>
            <label className="block text-sm font-medium text-baraka-dark mb-1.5">
              Business Name
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Mugakiriro Furniture Shop"
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

          {/* Full name */}
          <div>
            <label className="block text-sm font-medium text-baraka-dark mb-1.5">
              Your Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Moussa Nsengimana"
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

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-baraka-dark mb-1.5">
              Email Address
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

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-baraka-dark mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
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
                  transition-colors pr-10
                "
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-baraka-sage hover:text-baraka-dark transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-sm font-medium text-baraka-dark mb-1.5">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPass}
              onChange={(e) => setConfirmPass(e.target.value)}
              placeholder="Repeat your password"
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

          {/* Submit */}
          <Button
            type="submit"
            disabled={isLoading}
            className="
              w-full py-2.5
              bg-baraka-primary hover:bg-baraka-dark
              text-white font-medium
              rounded-lg transition-colors
              disabled:opacity-50 mt-2
            "
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Creating account...
              </span>
            ) : (
              "Create My Account"
            )}
          </Button>

        </form>

        <p className="text-center text-sm text-baraka-sage mt-6">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-baraka-primary hover:text-baraka-dark font-medium transition-colors"
          >
            Sign in
          </Link>
        </p>

      </div>

      <p className="text-center text-xs text-baraka-sage/60 mt-6">
        Built for furniture businesses in Rwanda 🇷🇼
      </p>
    </div>
  )
}