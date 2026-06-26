import { NextRequest, NextResponse } from "next/server"
import { requireSuperAdmin, getPlatformUserId } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import { serialize } from "@/lib/serialize"
import { createPlatformAuditLog } from "@/lib/platform-audit"
import { z } from "zod"

const PatchSchema = z.object({
  action: z.enum(["end", "revoke"]),
})

// GET /api/admin/support-sessions/[id] — session detail with all actions
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin()
  if (auth instanceof NextResponse) return auth

  const { id } = await params

  const session = await prisma.supportSession.findUnique({
    where: { id },
    include: {
      business:     { select: { id: true, name: true, email: true } },
      platformUser: { select: { id: true, name: true, email: true } },
      actions: {
        orderBy: { createdAt: "desc" },
        take: 100,
      },
    },
  })

  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 })

  return NextResponse.json(serialize(session))
}

// PATCH /api/admin/support-sessions/[id] — end or revoke a session
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const body   = await request.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const existing = await prisma.supportSession.findUnique({
    where:  { id },
    select: { id: true, status: true, businessId: true },
  })
  if (!existing) return NextResponse.json({ error: "Session not found" }, { status: 404 })

  if (existing.status !== "ACTIVE") {
    return NextResponse.json({ error: "Session is not active" }, { status: 400 })
  }

  const newStatus = parsed.data.action === "end" ? "ENDED" : "REVOKED"

  const updated = await prisma.supportSession.update({
    where: { id },
    data:  { status: newStatus, endedAt: new Date() },
  })

  const platformUserId = await getPlatformUserId()
  const auditAction = newStatus === "ENDED" ? "SUPPORT_SESSION_ENDED" : "SUPPORT_SESSION_REVOKED"
  createPlatformAuditLog({
    platformUserId,
    action:     auditAction,
    entityType: "SupportSession",
    entityId:   id,
    metadata:   { businessId: existing.businessId },
    ipAddress:  request.headers.get("x-forwarded-for") ?? undefined,
  })

  return NextResponse.json(serialize(updated))
}
