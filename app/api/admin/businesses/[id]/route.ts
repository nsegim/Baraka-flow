import { NextRequest, NextResponse } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import { serialize } from "@/lib/serialize"
import { z } from "zod"

const UpdateSchema = z.object({
  action: z.enum(["suspend", "unsuspend", "set-limits"]),
  suspendedReason: z.string().max(500).optional(),
  maxUsers:    z.number().int().positive().nullable().optional(),
  maxProducts: z.number().int().positive().nullable().optional(),
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

  const { action, suspendedReason, maxUsers, maxProducts } = parsed.data

  let updated
  if (action === "suspend") {
    updated = await prisma.business.update({
      where: { id },
      data: {
        status:          "SUSPENDED",
        suspendedAt:     new Date(),
        suspendedReason: suspendedReason ?? null,
      },
    })
  } else if (action === "unsuspend") {
    updated = await prisma.business.update({
      where: { id },
      data: {
        status:          "ACTIVE",
        suspendedAt:     null,
        suspendedReason: null,
      },
    })
  } else {
    // set-limits
    updated = await prisma.business.update({
      where: { id },
      data: {
        maxUsers:    maxUsers    ?? null,
        maxProducts: maxProducts ?? null,
      },
    })
  }

  return NextResponse.json(serialize(updated))
}

// DELETE /api/admin/businesses/[id] — permanently delete tenant and ALL their data
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const business = await prisma.business.findUnique({ where: { id } })
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 })

  // Delete in dependency order to respect foreign keys
  await prisma.$transaction([
    prisma.payment.deleteMany({
      where: { order: { businessId: id } }
    }),
    prisma.orderItem.deleteMany({
      where: { order: { businessId: id } }
    }),
    prisma.order.deleteMany({ where: { businessId: id } }),
    prisma.stockMovement.deleteMany({
      where: { product: { businessId: id } }
    }),
    prisma.purchaseOrderItem.deleteMany({
      where: { purchaseOrder: { businessId: id } }
    }),
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

  return NextResponse.json({ message: "Business and all associated data permanently deleted" })
}
