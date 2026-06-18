import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CreatePurchaseOrderSchema } from "@/lib/validators"
import { serialize } from "@/lib/serialize"

// GET /api/purchase-orders — paginated
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = request.nextUrl
    const page   = Math.max(1, parseInt(searchParams.get("page")   ?? "1"))
    const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50")))
    const skip   = (page - 1) * limit
    const status = searchParams.get("status")

    const where: Record<string, unknown> = { businessId: session.user.businessId }
    if (status) where.status = status

    const [orders, total] = await prisma.$transaction([
      prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier:  { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          items:     {
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
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!["OWNER", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const body   = await request.json()
    const parsed = CreatePurchaseOrderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    // Verify supplier belongs to this business
    const supplier = await prisma.supplier.findFirst({
      where: { id: parsed.data.supplierId, businessId: session.user.businessId },
    })
    if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 })

    const totalCost = parsed.data.items.reduce(
      (sum, item) => sum + item.quantity * item.unitCost, 0
    )

    // Generate PO number: PO-YYYYMM-NNNN
    const count    = await prisma.purchaseOrder.count({ where: { businessId: session.user.businessId } })
    const now      = new Date()
    const ym       = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`
    const poNumber = `PO-${ym}-${String(count + 1).padStart(4, "0")}`

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        supplierId:   parsed.data.supplierId,
        expectedDate: parsed.data.expectedDate ? new Date(parsed.data.expectedDate) : null,
        notes:        parsed.data.notes ?? null,
        totalCost,
        businessId:   session.user.businessId,
        createdById:  session.user.id,
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
        items:     {
          include: { product: { select: { id: true, name: true, unit: true } } },
        },
      },
    })

    return NextResponse.json(serialize(po), { status: 201 })

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to create purchase order" }, { status: 500 })
  }
}
