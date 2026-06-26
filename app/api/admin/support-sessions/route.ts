import { NextRequest, NextResponse } from "next/server"
import { requireSuperAdmin, getPlatformUserId } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import { serialize } from "@/lib/serialize"
import { createPlatformAuditLog } from "@/lib/platform-audit"
import { z } from "zod"

const CreateSchema = z.object({
  businessId:    z.string().min(1),
  justification: z.string().min(10, "Justification must be at least 10 characters"),
  accessScope:   z.enum(["READ_ONLY", "FULL_IMPERSONATION"]),
  durationHours: z.number().int().min(1).max(24).default(4),
})

// GET /api/admin/support-sessions — list all sessions
export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = request.nextUrl
  const status    = searchParams.get("status") ?? ""
  const page      = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
  const limit     = 20
  const skip      = (page - 1) * limit

  // Auto-expire sessions whose expiresAt has passed
  await prisma.supportSession.updateMany({
    where: { status: "ACTIVE", expiresAt: { lt: new Date() } },
    data:  { status: "EXPIRED" },
  })

  const where = status
    ? { status: status as "ACTIVE" | "EXPIRED" | "REVOKED" | "ENDED" }
    : {}

  const [sessions, total] = await prisma.$transaction([
    prisma.supportSession.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true, status: true, accessScope: true,
        justification: true, expiresAt: true, endedAt: true,
        createdAt: true, ipAddress: true,
        business: { select: { id: true, name: true, email: true } },
        platformUser: { select: { id: true, name: true, email: true } },
        _count: { select: { actions: true } },
      },
    }),
    prisma.supportSession.count({ where }),
  ])

  return NextResponse.json(serialize({
    data: sessions,
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  }))
}

// POST /api/admin/support-sessions — open a new support session
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin()
  if (auth instanceof NextResponse) return auth

  const platformUserId = await getPlatformUserId()
  if (!platformUserId) {
    return NextResponse.json(
      { error: "Support sessions require a PlatformUser account. Legacy admin email cannot open sessions." },
      { status: 403 }
    )
  }

  const body   = await request.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { businessId, justification, accessScope, durationHours } = parsed.data

  const business = await prisma.business.findUnique({
    where:  { id: businessId },
    select: { id: true, name: true },
  })
  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 })
  }

  const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000)

  const session = await prisma.supportSession.create({
    data: {
      platformUserId,
      businessId,
      justification,
      accessScope,
      expiresAt,
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    },
    include: {
      business:     { select: { id: true, name: true, email: true } },
      platformUser: { select: { id: true, name: true, email: true } },
    },
  })

  createPlatformAuditLog({
    platformUserId,
    action:     "SUPPORT_SESSION_OPENED",
    entityType: "Business",
    entityId:   businessId,
    metadata:   { sessionId: session.id, accessScope, justification, durationHours, businessName: business.name },
    ipAddress:  request.headers.get("x-forwarded-for") ?? undefined,
  })

  return NextResponse.json(serialize(session), { status: 201 })
}
