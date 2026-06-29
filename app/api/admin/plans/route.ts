import { NextRequest, NextResponse } from "next/server"
import { requireSuperAdmin, getPlatformUserId } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import { serialize } from "@/lib/serialize"
import { createPlatformAuditLog } from "@/lib/platform-audit"
import { z } from "zod"

const PlanSchema = z.object({
  name:        z.string().min(1).max(100),
  slug:        z.string().min(1).max(50).regex(/^[a-z][a-z0-9-]*$/, "Slug must be lowercase letters, numbers and hyphens"),
  description: z.string().max(500).optional().nullable(),
  price:       z.number().min(0).default(0),
  currency:    z.string().default("RWF"),
  maxUsers:    z.number().int().positive().nullable().optional(),
  maxProducts: z.number().int().positive().nullable().optional(),
  maxOrders:   z.number().int().positive().nullable().optional(),
  maxBranches: z.number().int().positive().nullable().optional(),
  features:    z.record(z.string(), z.boolean()).optional().default({}),
  isActive:    z.boolean().default(true),
  isPublic:    z.boolean().default(true),
  sortOrder:   z.number().int().min(0).default(0),
})

// GET /api/admin/plans — list all plans with business counts
export async function GET() {
  const auth = await requireSuperAdmin()
  if (auth instanceof NextResponse) return auth

  const plans = await prisma.plan.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { businesses: true } },
    },
  })

  return NextResponse.json(serialize(plans))
}

// POST /api/admin/plans — create a new plan
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin()
  if (auth instanceof NextResponse) return auth

  const body   = await request.json()
  const parsed = PlanSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const existing = await prisma.plan.findUnique({ where: { slug: parsed.data.slug } })
  if (existing) {
    return NextResponse.json({ error: `A plan with slug "${parsed.data.slug}" already exists` }, { status: 409 })
  }

  const plan = await prisma.plan.create({
    data: {
      ...parsed.data,
      features: parsed.data.features as object,
    },
    include: { _count: { select: { businesses: true } } },
  })

  const platformUserId = await getPlatformUserId()
  createPlatformAuditLog({
    platformUserId,
    action:     "PLAN_CREATED",
    entityType: "Plan",
    entityId:   plan.id,
    metadata:   { name: plan.name, slug: plan.slug },
    ipAddress:  request.headers.get("x-forwarded-for") ?? undefined,
  })

  return NextResponse.json(serialize(plan), { status: 201 })
}
