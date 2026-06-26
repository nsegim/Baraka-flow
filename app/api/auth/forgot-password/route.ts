import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { sendPasswordResetEmail } from "@/lib/email"
import { rateLimit, getIp, rateLimitResponse } from "@/lib/rate-limit"
import { createAuditLog } from "@/lib/audit"
import { z } from "zod"

const Schema = z.object({
  email: z.string().email("Invalid email address"),
})

// POST /api/auth/forgot-password
export async function POST(request: NextRequest) {
  // Rate limit: 3 attempts per 15 minutes per IP
  const ip     = getIp(request)
  const result = rateLimit(`forgot-pwd:${ip}`, 15 * 60 * 1000, 3)
  if (!result.success) return rateLimitResponse(result)

  // Always respond with 200 regardless of whether email exists.
  // This prevents email enumeration attacks.
  const SAFE_RESPONSE = NextResponse.json({
    message: "If that email is registered, you will receive a reset link shortly.",
  })

  try {
    const body   = await request.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return SAFE_RESPONSE

    const { email } = parsed.data

    const user = await prisma.user.findUnique({
      where:  { email: email.toLowerCase() },
      select: { id: true, name: true, email: true, businessId: true },
    })

    if (!user) return SAFE_RESPONSE

    // Invalidate any existing unused tokens for this email
    await prisma.passwordResetToken.updateMany({
      where: { email: user.email, usedAt: null },
      data:  { usedAt: new Date() },
    })

    // Generate a cryptographically random 32-byte token
    const rawToken  = crypto.randomBytes(32).toString("hex")          // sent in URL
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex") // stored

    await prisma.passwordResetToken.create({
      data: {
        tokenHash,
        email:     user.email,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    })

    const baseUrl  = process.env.NEXTAUTH_URL ?? "http://localhost:3000"
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`

    // Fire-and-forget — email failure must not reveal whether email exists
    sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl }).catch(() => {})

    // Audit log
    createAuditLog({
      businessId: user.businessId,
      userId:     user.id,
      action:     "PASSWORD_RESET_REQUESTED",
      entityType: "User",
      entityId:   user.id,
      metadata:   { email: user.email },
      ipAddress:  ip,
    })

    return SAFE_RESPONSE
  } catch (error) {
    console.error("Forgot password error:", error)
    return SAFE_RESPONSE // never reveal server errors on this endpoint
  }
}
