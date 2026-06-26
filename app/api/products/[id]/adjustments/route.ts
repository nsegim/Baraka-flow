import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { serialize } from "@/lib/serialize"
import { z } from "zod"
import { requireBranchContext, isBranchContext, getWriteBranchId } from "@/lib/branch-auth"
import { createAuditLog } from "@/lib/audit"
import { getIp } from "@/lib/rate-limit"

const CreateAdjustmentSchema = z.object({
  type:      z.enum(["ADJUSTMENT", "DAMAGE", "RETURN"]),
  quantity:  z.number().int().positive("Quantity must be at least 1"),
  direction: z.enum(["add", "remove"]).optional(),
  reason:    z.string().min(1, "Reason is required").max(500),
})

// GET /api/products/[id]/adjustments — last 50 stock movements for this branch
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireBranchContext(request)
    if (!isBranchContext(ctx)) return ctx

    const { id } = await params

    const product = await prisma.product.findFirst({
      where: { id, businessId: ctx.session.user.businessId },
    })
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 })

    const where: Record<string, unknown> = { productId: id }
    if (ctx.branchId) where.branchId = ctx.branchId

    const movements = await prisma.stockMovement.findMany({
      where,
      include: {
        user:   { select: { name: true } },
        branch: { select: { name: true, code: true } },
      },
      orderBy: { createdAt: "desc" },
      take:    50,
    })

    return NextResponse.json(serialize(movements))
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to fetch movements" }, { status: 500 })
  }
}

// POST /api/products/[id]/adjustments — OWNER and MANAGER only
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireBranchContext(request, { requireBranch: true })
    if (!isBranchContext(ctx)) return ctx

    if (!["OWNER", "MANAGER"].includes(ctx.session.user.role)) {
      return NextResponse.json({ error: "Only Managers and Owners can adjust stock" }, { status: 403 })
    }

    const branchId = getWriteBranchId(ctx, new URL(request.url).searchParams.get("branchId"))
    if (!branchId) {
      return NextResponse.json({ error: "Select a branch to adjust stock" }, { status: 400 })
    }

    const { id } = await params
    const body   = await request.json()
    const parsed = CreateAdjustmentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { type, quantity, direction, reason } = parsed.data

    const product = await prisma.product.findFirst({
      where: { id, businessId: ctx.session.user.businessId },
    })
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 })

    const inventory = await prisma.branchInventory.findUnique({
      where: { branchId_productId: { branchId, productId: id } },
    })
    const currentStock = inventory?.stock ?? 0

    let delta: number
    if (type === "DAMAGE") {
      delta = -quantity
    } else if (type === "RETURN") {
      delta = quantity
    } else {
      delta = direction === "remove" ? -quantity : quantity
    }

    const newStock = currentStock + delta
    if (newStock < 0) {
      return NextResponse.json(
        { error: `Cannot remove ${quantity} — only ${currentStock} in stock at this branch` },
        { status: 400 }
      )
    }

    const movement = await prisma.$transaction(async (tx) => {
      await tx.branchInventory.upsert({
        where:  { branchId_productId: { branchId, productId: id } },
        update: { stock: newStock },
        create: { branchId, productId: id, stock: newStock, minStock: 5 },
      })
      return tx.stockMovement.create({
        data: {
          type,
          quantity: delta,
          reason,
          productId: id,
          branchId,
          userId:    ctx.session.user.id,
        },
        include: {
          user:   { select: { name: true } },
          branch: { select: { name: true, code: true } },
        },
      })
    })

    createAuditLog({
      businessId: ctx.session.user.businessId,
      branchId,
      userId:     ctx.session.user.id,
      action:     "STOCK_ADJUSTED",
      entityType: "Product",
      entityId:   id,
      metadata:   { productName: product.name, type, delta, newStock, reason },
      ipAddress:  getIp(request),
    })

    return NextResponse.json(serialize(movement), { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to create adjustment" }, { status: 500 })
  }
}
