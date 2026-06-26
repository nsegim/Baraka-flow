import { NextRequest, NextResponse } from "next/server"
import { requireSuperAdmin, getPlatformUserId } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import { createPlatformAuditLog } from "@/lib/platform-audit"
import { z } from "zod"
import bcrypt from "bcryptjs"

const Schema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
})

// POST /api/admin/users/[id]/reset-password
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const body   = await request.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where:  { id },
    select: { id: true, email: true, businessId: true },
  })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const hashed = await bcrypt.hash(parsed.data.newPassword, 12)
  await prisma.user.update({ where: { id }, data: { password: hashed } })

  const platformUserId = await getPlatformUserId()
  createPlatformAuditLog({
    platformUserId,
    action:     "PASSWORD_RESET_INITIATED",
    entityType: "User",
    entityId:   id,
    metadata:   { targetEmail: user.email, businessId: user.businessId },
    ipAddress:  request.headers.get("x-forwarded-for") ?? undefined,
  })

  return NextResponse.json({ message: "Password reset successfully" })
}
