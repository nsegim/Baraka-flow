import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { CreatePurchaseOrderSchema } from "@/lib/validators"
import { serialize } from "@/lib/serialize"
import { createAuditLog } from "@/lib/audit"
import { getIp } from "@/lib/rate-limit"
import { requireBranchContext, isBranchContext, buildBranchWhere, getWriteBranchId } from "@/lib/branch-auth"
import { can, type Role } from "@/lib/permissions"

// GET /api/purchase-orders — paginated, branch-scoped
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireBranchContext(request)
    if (!isBranchContext(ctx)) return ctx

    const { searchParams } = request.nextUrl
    const page   = Math.max(1, parseInt(searchParams.get("page")   ?? "1"))
    const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50")))
    const skip   = (page - 1) * limit
    const status = searchParams.get("status")

    const supplierId = searchParams.get("supplierId")

    const where: Record<string, unknown> = buildBranchWhere(ctx)
    if (status)     where.status     = status
    if (supplierId) where.supplierId = supplierId

    const [orders, total] = await prisma.$transaction([
      prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier:  { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          branch:    { select: { name: true, code: true } },
          items: {
            include: { product: { select: { id: true, name: true, unit: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.purchaseOrder.count({ where }),
    ])

    return NextResponse.json({
      data: serialize(orders),
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to fetch purchase orders" }, { status: 500 })
  }
}

// POST /api/purchase-orders — OWNER and MANAGER
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireBranchContext(request, { requireBranch: true })
    if (!isBranchContext(ctx)) return ctx

    if (!can(ctx.session.user.role as Role, "purchase-order:create")) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const branchId = getWriteBranchId(ctx, new URL(request.url).searchParams.get("branchId"))
    if (!branchId) {
      return NextResponse.json({ error: "Select a branch before creating a purchase order" }, { status: 400 })
    }

    const branch = await prisma.branch.findFirst({
      where: { id: branchId, businessId: ctx.session.user.businessId, isActive: true },
      select: { code: true },
    })
    if (!branch) return NextResponse.json({ error: "Branch not found" }, { status: 404 })

    const body   = await request.json()
    const parsed = CreatePurchaseOrderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const supplier = await prisma.supplier.findFirst({
      where: { id: parsed.data.supplierId, businessId: ctx.session.user.businessId },
    })
    if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 })

    const totalCost = parsed.data.items.reduce(
      (sum, item) => sum + item.quantity * item.unitCost, 0
    )

    // Branch-scoped PO number: PO-{CODE}-{YYYYMM}-{SEQ}
    const count    = await prisma.purchaseOrder.count({ where: { branchId } })
    const now      = new Date()
    const ym       = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`
    const poNumber = `PO-${branch.code}-${ym}-${String(count + 1).padStart(4, "0")}`

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        supplierId:   parsed.data.supplierId,
        expectedDate: parsed.data.expectedDate ? new Date(parsed.data.expectedDate) : null,
        notes:        parsed.data.notes ?? null,
        totalCost,
        businessId:   ctx.session.user.businessId,
        branchId,
        createdById:  ctx.session.user.id,
        items: {
          create: parsed.data.items.map(item => ({
            productId: item.productId,
            quantity:  item.quantity,
            unitCost:  item.unitCost,
          })),
        },
      },
      include: {
        supplier:  { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        branch:    { select: { name: true, code: true } },
        items: {
          include: { product: { select: { id: true, name: true, unit: true } } },
        },
      },
    })

    createAuditLog({
      businessId: ctx.session.user.businessId,
      branchId,
      userId:     ctx.session.user.id,
      action:     "PURCHASE_ORDER_CREATED",
      entityType: "PurchaseOrder",
      entityId:   po.id,
      metadata:   { poNumber: po.poNumber, supplierName: po.supplier.name, totalCost },
      ipAddress:  getIp(request),
    })

    return NextResponse.json(serialize(po), { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to create purchase order" }, { status: 500 })
  }
}
