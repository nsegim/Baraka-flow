import { NextRequest, NextResponse } from "next/server"
import { requireSuperAdmin, getPlatformUserId } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import { serialize } from "@/lib/serialize"
import { createPlatformAuditLog } from "@/lib/platform-audit"
import { z } from "zod"
import bcrypt from "bcryptjs"

const CreateBusinessSchema = z.object({
  businessName:  z.string().min(2).max(200),
  ownerName:     z.string().min(2).max(100),
  ownerEmail:    z.email("Invalid email"),
  ownerPassword: z.string().min(8, "Password must be at least 8 characters"),
  currency:      z.string().default("RWF"),
  maxUsers:      z.number().int().positive().nullable().optional(),
  maxProducts:   z.number().int().positive().nullable().optional(),
})

// GET /api/admin/businesses — tenant registry (metadata only, no operational data)
export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = request.nextUrl
  const search = searchParams.get("search") ?? ""
  const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
  const limit  = 20
  const skip   = (page - 1) * limit

  const where = search
    ? { OR: [
        { name:  { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } },
      ]}
    : {}

  const [businesses, total] = await prisma.$transaction([
    prisma.business.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true, name: true, email: true, phone: true,
        currency: true, status: true, plan: true, planExpiresAt: true,
        suspendedAt: true, suspendedReason: true,
        maxUsers: true, maxProducts: true,
        createdAt: true, updatedAt: true,
        // Metadata counts only — no operational/financial data
        _count: {
          select: {
            users:    true,
            branches: true,
          },
        },
        // Owner info for contact purposes
        users: {
          where: { role: "OWNER" },
          select: { name: true, email: true, createdAt: true },
          take: 1,
        },
      },
    }),
    prisma.business.count({ where }),
  ])

  return NextResponse.json(serialize({
    data: businesses,
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  }))
}

// POST /api/admin/businesses — create a new tenant with an owner account
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin()
  if (auth instanceof NextResponse) return auth

  const body   = await request.json()
  const parsed = CreateBusinessSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { businessName, ownerName, ownerEmail, ownerPassword, currency, maxUsers, maxProducts } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email: ownerEmail } })
  if (existing) {
    return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 })
  }

  const hashed = await bcrypt.hash(ownerPassword, 12)

  const business = await prisma.business.create({
    data: {
      name:        businessName,
      email:       ownerEmail,
      currency,
      maxUsers:    maxUsers    ?? null,
      maxProducts: maxProducts ?? null,
      users: {
        create: {
          name:     ownerName,
          email:    ownerEmail,
          password: hashed,
          role:     "OWNER",
        },
      },
    },
    include: {
      _count: { select: { users: true } },
    },
  })

  const platformUserId = await getPlatformUserId()
  createPlatformAuditLog({
    platformUserId,
    action:     "TENANT_CREATED",
    entityType: "Business",
    entityId:   business.id,
    metadata:   { businessName, ownerEmail, currency },
    ipAddress:  request.headers.get("x-forwarded-for") ?? undefined,
  })

  return NextResponse.json(serialize(business), { status: 201 })
}
