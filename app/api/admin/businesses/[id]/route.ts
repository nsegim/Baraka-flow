import { NextRequest, NextResponse } from "next/server"
import { requireSuperAdmin, getPlatformUserId } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import { serialize } from "@/lib/serialize"
import { createPlatformAuditLog } from "@/lib/platform-audit"
import { z } from "zod"

const UpdateSchema = z.object({
  action:             z.enum(["suspend", "unsuspend", "set-limits", "assign-plan"]),
  suspendedReason:    z.string().max(500).optional(),
  maxUsers:           z.number().int().positive().nullable().optional(),
  maxProducts:        z.number().int().positive().nullable().optional(),
  maxOrders:          z.number().int().positive().nullable().optional(),
  maxBranches:        z.number().int().positive().nullable().optional(),
  planId:             z.string().optional().nullable(),
  subscriptionStatus: z.enum(["TRIAL", "ACTIVE", "SUSPENDED", "EXPIRED", "CANCELLED"]).optional(),
  trialEndsAt:        z.string().datetime().optional().nullable(),
  planExpiresAt:      z.string().datetime().optional().nullable(),
})

// PATCH /api/admin/businesses/[id] — suspend, unsuspend, or set limits
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const body   = await request.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const business = await prisma.business.findUnique({ where: { id } })
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 })

  const {
    action, suspendedReason,
    maxUsers, maxProducts, maxOrders, maxBranches,
    planId, subscriptionStatus, trialEndsAt, planExpiresAt,
  } = parsed.data

  let updated
  let auditAction: "TENANT_SUSPENDED" | "TENANT_UNSUSPENDED" | "TENANT_PLAN_CHANGED"
  let auditMeta: Record<string, unknown>

  if (action === "suspend") {
    updated = await prisma.business.update({
      where: { id },
      data: {
        status:          "SUSPENDED",
        suspendedAt:     new Date(),
        suspendedReason: suspendedReason ?? null,
      },
    })
    auditAction = "TENANT_SUSPENDED"
    auditMeta   = { suspendedReason }
  } else if (action === "unsuspend") {
    updated = await prisma.business.update({
      where: { id },
      data: {
        status:          "ACTIVE",
        suspendedAt:     null,
        suspendedReason: null,
      },
    })
    auditAction = "TENANT_UNSUSPENDED"
    auditMeta   = {}
  } else if (action === "assign-plan") {
    updated = await prisma.business.update({
      where: { id },
      data: {
        planId:             planId             ?? null,
        subscriptionStatus: subscriptionStatus ?? "ACTIVE",
        trialEndsAt:        trialEndsAt  ? new Date(trialEndsAt)  : null,
        planExpiresAt:      planExpiresAt ? new Date(planExpiresAt) : null,
      },
    })
    auditAction = "TENANT_PLAN_CHANGED"
    auditMeta   = { planId, subscriptionStatus, trialEndsAt, planExpiresAt }
  } else {
    // set-limits
    updated = await prisma.business.update({
      where: { id },
      data: {
        maxUsers:    maxUsers    ?? null,
        maxProducts: maxProducts ?? null,
        maxOrders:   maxOrders   ?? null,
        maxBranches: maxBranches ?? null,
      },
    })
    auditAction = "TENANT_PLAN_CHANGED"
    auditMeta   = { maxUsers, maxProducts, maxOrders, maxBranches }
  }

  const platformUserId = await getPlatformUserId()
  createPlatformAuditLog({
    platformUserId,
    action:     auditAction,
    entityType: "Business",
    entityId:   id,
    metadata:   { action, ...auditMeta },
    ipAddress:  request.headers.get("x-forwarded-for") ?? undefined,
  })

  return NextResponse.json(serialize(updated))
}

// DELETE /api/admin/businesses/[id] — permanently delete tenant and ALL their data
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const business = await prisma.business.findUnique({ where: { id }, select: { id: true, name: true } })
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 })

  // Delete in dependency order to respect foreign keys.
  // Support session records are deleted first (new platform-layer data).
  await prisma.$transaction([
    prisma.supportAction.deleteMany({ where: { session: { businessId: id } } }),
    prisma.supportSession.deleteMany({ where: { businessId: id } }),
    prisma.payment.deleteMany({ where: { order: { businessId: id } } }),
    prisma.orderItem.deleteMany({ where: { order: { businessId: id } } }),
    prisma.order.deleteMany({ where: { businessId: id } }),
    prisma.stockMovement.deleteMany({ where: { product: { businessId: id } } }),
    prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { businessId: id } } }),
    prisma.purchaseOrder.deleteMany({ where: { businessId: id } }),
    prisma.product.deleteMany({ where: { businessId: id } }),
    prisma.category.deleteMany({ where: { businessId: id } }),
    prisma.supplier.deleteMany({ where: { businessId: id } }),
    prisma.creditNote.deleteMany({ where: { businessId: id } }),
    prisma.customer.deleteMany({ where: { businessId: id } }),
    prisma.expense.deleteMany({ where: { businessId: id } }),
    prisma.notification.deleteMany({ where: { businessId: id } }),
    prisma.user.deleteMany({ where: { businessId: id } }),
    prisma.business.delete({ where: { id } }),
  ])

  const platformUserId = await getPlatformUserId()
  createPlatformAuditLog({
    platformUserId,
    action:     "TENANT_DELETED",
    entityType: "Business",
    entityId:   id,
    metadata:   { businessName: business.name },
    ipAddress:  request.headers.get("x-forwarded-for") ?? undefined,
  })

  return NextResponse.json({ message: "Business and all associated data permanently deleted" })
}
