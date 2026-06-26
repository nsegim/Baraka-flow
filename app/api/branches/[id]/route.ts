import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UpdateBranchSchema } from "@/lib/validators"
import { serialize } from "@/lib/serialize"
import { createAuditLog } from "@/lib/audit"
import { getIp } from "@/lib/rate-limit"

// GET /api/branches/[id] — branch detail with staff and inventory summary
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Only owners can view branch details" }, { status: 403 })
    }

    const { id } = await params

    const branch = await prisma.branch.findFirst({
      where:   { id, businessId: session.user.businessId },
      include: {
        users: {
          include: { user: { select: { id: true, name: true, email: true, role: true, isActive: true } } },
          orderBy: { assignedAt: "asc" },
        },
        _count: { select: { orders: true, expenses: true, purchaseOrders: true } },
      },
    })

    if (!branch) return NextResponse.json({ error: "Branch not found" }, { status: 404 })

    // Stock summary
    type StockRow = { totalStock: string; lowStockCount: string; outOfStockCount: string }
    const [stockSummary] = await prisma.$queryRaw<StockRow[]>`
      SELECT
        COALESCE(SUM(bi.stock), 0)::text                                  AS "totalStock",
        COUNT(*) FILTER (WHERE bi.stock > 0 AND bi.stock <= bi."minStock")::text AS "lowStockCount",
        COUNT(*) FILTER (WHERE bi.stock = 0)::text                        AS "outOfStockCount"
      FROM "BranchInventory" bi
      WHERE bi."branchId" = ${id}
    `

    return NextResponse.json(serialize({
      ...branch,
      stockSummary: {
        totalStock:     Number(stockSummary?.totalStock     ?? 0),
        lowStockCount:  Number(stockSummary?.lowStockCount  ?? 0),
        outOfStockCount: Number(stockSummary?.outOfStockCount ?? 0),
      },
    }))
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to fetch branch" }, { status: 500 })
  }
}

// PATCH /api/branches/[id] — update branch (OWNER only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Only owners can update branches" }, { status: 403 })
    }

    const { id } = await params
    const existing = await prisma.branch.findFirst({
      where: { id, businessId: session.user.businessId },
    })
    if (!existing) return NextResponse.json({ error: "Branch not found" }, { status: 404 })

    const body   = await request.json()
    const parsed = UpdateBranchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    // Prevent deactivating the default branch if it's the only active one
    if (parsed.data.isActive === false && existing.isDefault) {
      const activeCount = await prisma.branch.count({
        where: { businessId: session.user.businessId, isActive: true },
      })
      if (activeCount <= 1) {
        return NextResponse.json(
          { error: "Cannot deactivate the only active branch" },
          { status: 400 }
        )
      }
    }

    const updated = await prisma.branch.update({
      where: { id },
      data: {
        name:     parsed.data.name     ?? existing.name,
        address:  parsed.data.address  ?? existing.address,
        phone:    parsed.data.phone    ?? existing.phone,
        isActive: parsed.data.isActive ?? existing.isActive,
      },
    })

    createAuditLog({
      businessId: session.user.businessId,
      branchId:   id,
      userId:     session.user.id,
      action:     "BRANCH_UPDATED",
      entityType: "Branch",
      entityId:   id,
      metadata:   { before: { name: existing.name }, after: { name: updated.name } },
      ipAddress:  getIp(request),
    })

    return NextResponse.json(serialize(updated))
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to update branch" }, { status: 500 })
  }
}

// DELETE /api/branches/[id] — soft-delete by deactivating (OWNER only)
// We don't hard-delete because branches have historical orders/expenses.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Only owners can remove branches" }, { status: 403 })
    }

    const { id } = await params
    const existing = await prisma.branch.findFirst({
      where: { id, businessId: session.user.businessId },
    })
    if (!existing) return NextResponse.json({ error: "Branch not found" }, { status: 404 })

    if (existing.isDefault) {
      return NextResponse.json(
        { error: "The default branch cannot be deleted" },
        { status: 400 }
      )
    }

    // Check for active staff assigned only to this branch
    const exclusiveStaff = await prisma.branchUser.count({
      where: {
        branchId: id,
        user: {
          isActive:          true,
          branchAssignments: { every: { branchId: id } },
        },
      },
    })
    if (exclusiveStaff > 0) {
      return NextResponse.json(
        { error: `${exclusiveStaff} staff member(s) are assigned only to this branch. Reassign them before removing the branch.` },
        { status: 400 }
      )
    }

    await prisma.branch.update({
      where: { id },
      data:  { isActive: false },
    })

    createAuditLog({
      businessId: session.user.businessId,
      branchId:   id,
      userId:     session.user.id,
      action:     "BRANCH_UPDATED",
      entityType: "Branch",
      entityId:   id,
      metadata:   { action: "deactivated", name: existing.name },
      ipAddress:  getIp(request),
    })

    return NextResponse.json({ message: "Branch deactivated" })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to remove branch" }, { status: 500 })
  }
}
