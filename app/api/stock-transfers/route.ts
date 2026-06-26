import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CreateStockTransferSchema } from "@/lib/validators"
import { serialize } from "@/lib/serialize"
import { createAuditLog } from "@/lib/audit"
import { createNotification } from "@/lib/notify"
import { getIp } from "@/lib/rate-limit"

// GET /api/stock-transfers — list transfers scoped to business/branch
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = request.nextUrl
    const page    = Math.max(1, parseInt(searchParams.get("page")  ?? "1"))
    const limit   = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50")))
    const skip    = (page - 1) * limit
    const status  = searchParams.get("status") ?? undefined

    const where: Record<string, unknown> = { businessId: session.user.businessId }
    if (status) where.status = status

    // MANAGER/STAFF see only transfers involving their branch
    if (session.user.role !== "OWNER" && session.user.branchId) {
      where.OR = [
        { fromBranchId: session.user.branchId },
        { toBranchId:   session.user.branchId },
      ]
    }

    const [transfers, total] = await prisma.$transaction([
      prisma.stockTransfer.findMany({
        where,
        include: {
          fromBranch:  { select: { id: true, name: true, code: true } },
          toBranch:    { select: { id: true, name: true, code: true } },
          product:     { select: { id: true, name: true, unit: true } },
          requestedBy: { select: { id: true, name: true } },
          approvedBy:  { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.stockTransfer.count({ where }),
    ])

    return NextResponse.json({
      data: serialize(transfers),
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to fetch stock transfers" }, { status: 500 })
  }
}

// POST /api/stock-transfers — request a transfer (OWNER or MANAGER)
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!["OWNER", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const body   = await request.json()
    const parsed = CreateStockTransferSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { fromBranchId, toBranchId, productId, quantity, notes } = parsed.data

    if (fromBranchId === toBranchId) {
      return NextResponse.json({ error: "Source and destination branch must be different" }, { status: 400 })
    }

    // Validate both branches belong to this business
    const [fromBranch, toBranch] = await Promise.all([
      prisma.branch.findFirst({ where: { id: fromBranchId, businessId: session.user.businessId, isActive: true } }),
      prisma.branch.findFirst({ where: { id: toBranchId,   businessId: session.user.businessId, isActive: true } }),
    ])
    if (!fromBranch) return NextResponse.json({ error: "Source branch not found" }, { status: 404 })
    if (!toBranch)   return NextResponse.json({ error: "Destination branch not found" }, { status: 404 })

    // MANAGER can only initiate from their assigned branch
    if (session.user.role === "MANAGER" && session.user.branchId !== fromBranchId) {
      return NextResponse.json({ error: "You can only initiate transfers from your assigned branch" }, { status: 403 })
    }

    // Validate product belongs to this business
    const product = await prisma.product.findFirst({
      where: { id: productId, businessId: session.user.businessId },
      select: { id: true, name: true },
    })
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 })

    // Check available stock in source branch
    const sourceInventory = await prisma.branchInventory.findUnique({
      where: { branchId_productId: { branchId: fromBranchId, productId } },
    })
    const availableStock = sourceInventory?.stock ?? 0
    if (availableStock < quantity) {
      return NextResponse.json(
        { error: `Insufficient stock in ${fromBranch.name}. Available: ${availableStock}, requested: ${quantity}` },
        { status: 400 }
      )
    }

    const transfer = await prisma.stockTransfer.create({
      data: {
        fromBranchId,
        toBranchId,
        productId,
        quantity,
        notes:          notes ?? null,
        status:         "PENDING",
        requestedById:  session.user.id,
        businessId:     session.user.businessId,
      },
      include: {
        fromBranch:  { select: { id: true, name: true, code: true } },
        toBranch:    { select: { id: true, name: true, code: true } },
        product:     { select: { id: true, name: true, unit: true } },
        requestedBy: { select: { id: true, name: true } },
      },
    })

    createNotification(
      session.user.businessId,
      "STOCK_TRANSFER",
      `Stock Transfer Requested`,
      `${quantity}x ${product.name} from ${fromBranch.name} → ${toBranch.name}`,
      "/stock-transfers",
      null, // business-wide notification so owner sees it
    )

    createAuditLog({
      businessId: session.user.businessId,
      branchId:   fromBranchId,
      userId:     session.user.id,
      action:     "STOCK_TRANSFER_REQUESTED",
      entityType: "StockTransfer",
      entityId:   transfer.id,
      metadata:   { productName: product.name, quantity, fromBranch: fromBranch.name, toBranch: toBranch.name },
      ipAddress:  getIp(request),
    })

    return NextResponse.json(serialize(transfer), { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to create stock transfer" }, { status: 500 })
  }
}
