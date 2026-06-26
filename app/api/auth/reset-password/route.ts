import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { rateLimit, getIp, rateLimitResponse } from "@/lib/rate-limit"
import { createAuditLog } from "@/lib/audit"
import { z } from "zod"

const Schema = z.object({
  token:    z.string().min(1, "Token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

// POST /api/auth/reset-password
export async function POST(request: NextRequest) {
  // Rate limit: 10 attempts per hour per IP (prevents token brute-forcing)
  const ip     = getIp(request)
  const result = rateLimit(`reset-pwd:${ip}`, 60 * 60 * 1000, 10)
  if (!result.success) return rateLimitResponse(result)

  try {
    const body   = await request.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { token, password } = parsed.data

    // Hash the incoming token and look it up — we never store the raw token
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex")

    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    })

    if (!record)                        return NextResponse.json({ error: "Invalid or expired reset link." }, { status: 400 })
    if (record.usedAt)                  return NextResponse.json({ error: "This reset link has already been used." }, { status: 400 })
    if (record.expiresAt < new Date())  return NextResponse.json({ error: "This reset link has expired. Please request a new one." }, { status: 400 })

    const user = await prisma.user.findUnique({
      where:  { email: record.email },
      select: { id: true, businessId: true },
    })
    if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 })

    const hashedPassword = await bcrypt.hash(password, 12)

    // Atomically update password and mark token as used
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data:  { password: hashedPassword },
      }),
      prisma.passwordResetToken.update({
        where: { tokenHash },
        data:  { usedAt: new Date() },
      }),
    ])

    createAuditLog({
      businessId: user.businessId,
      userId:     user.id,
      action:     "PASSWORD_RESET_COMPLETED",
      entityType: "User",
      entityId:   user.id,
      metadata:   { email: record.email },
      ipAddress:  ip,
    })

    return NextResponse.json({ message: "Password updated successfully. You can now sign in." })
  } catch (error) {
    console.error("Reset password error:", error)
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 })
  }
}
