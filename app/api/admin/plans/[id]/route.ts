import { NextRequest, NextResponse } from "next/server"
import { requireSuperAdmin, getPlatformUserId } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import { serialize } from "@/lib/serialize"
import { createPlatformAuditLog } from "@/lib/platform-audit"
import { z } from "zod"

const UpdatePlanSchema = z.object({
  name:        z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  price:       z.number().min(0).optional(),
  currency:    z.string().optional(),
  maxUsers:    z.number().int().positive().nullable().optional(),
  maxProducts: z.number().int().positive().nullable().optional(),
  maxOrders:   z.number().int().positive().nullable().optional(),
  maxBranches: z.number().int().positive().nullable().optional(),
  features:    z.record(z.string(), z.boolean()).optional(),
  isActive:    z.boolean().optional(),
  isPublic:    z.boolean().optional(),
  sortOrder:   z.number().int().min(0).optional(),
})

// PATCH /api/admin/plans/[id] — update plan (immediately affects all subscribers)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSuperAdmin()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const body    = await request.json()
  const parsed  = UpdatePlanSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const existing = await prisma.plan.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Plan not found" }, { status: 404 })

  const { features, ...rest } = parsed.data
  const updated = await prisma.plan.update({
    where: { id },
    data: {
      ...rest,
      ...(features !== undefined ? { features: features as object } : {}),
      updatedAt: new Date(),
    },
    include: { _count: { select: { businesses: true } } },
  })

  const platformUserId = await getPlatformUserId()
  createPlatformAuditLog({
    platformUserId,
    action:     "PLAN_UPDATED",
    entityType: "Plan",
    entityId:   id,
    metadata:   parsed.data,
    ipAddress:  request.headers.get("x-forwarded-for") ?? undefined,
  })

  return NextResponse.json(serialize(updated))
}

// DELETE /api/admin/plans/[id] — deactivate if businesses use it; hard-delete if not
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSuperAdmin()
  if (auth instanceof NextResponse) return auth

  const { id } = await params

  const plan = await prisma.plan.findUnique({
    where:   { id },
    include: { _count: { select: { businesses: true } } },
  })
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 })

  const platformUserId = await getPlatformUserId()

  if (plan._count.businesses > 0) {
    // Businesses are on this plan — deactivate instead of deleting
    await prisma.plan.update({ where: { id }, data: { isActive: false } })
    createPlatformAuditLog({
      platformUserId,
      action:     "PLAN_DELETED",
      entityType: "Plan",
      entityId:   id,
      metadata:   { name: plan.name, action: "deactivated", reason: "businesses_still_subscribed", count: plan._count.businesses },
      ipAddress:  request.headers.get("x-forwarded-for") ?? undefined,
    })
    return NextResponse.json({ message: `Plan deactivated (${plan._count.businesses} business(es) still subscribed — plan preserved)` })
  }

  await prisma.plan.delete({ where: { id } })
  createPlatformAuditLog({
    platformUserId,
    action:     "PLAN_DELETED",
    entityType: "Plan",
    entityId:   id,
    metadata:   { name: plan.name, action: "hard_deleted" },
    ipAddress:  request.headers.get("x-forwarded-for") ?? undefined,
  })
  return NextResponse.json({ message: "Plan permanently deleted" })
}
