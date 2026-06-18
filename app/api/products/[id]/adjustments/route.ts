import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { serialize } from "@/lib/serialize"
import { z } from "zod"

const CreateAdjustmentSchema = z.object({
  type:      z.enum(["ADJUSTMENT", "DAMAGE", "RETURN"]),
  quantity:  z.number().int().positive("Quantity must be at least 1"),
  direction: z.enum(["add", "remove"]).optional(),
  reason:    z.string().min(1, "Reason is required").max(500),
})

// GET /api/products/[id]/adjustments — last 50 stock movements
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params

    const product = await prisma.product.findFirst({
      where: { id, businessId: session.user.businessId },
    })
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 })

    const movements = await prisma.stockMovement.findMany({
      where: { productId: id },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!["OWNER", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Only Managers and Owners can adjust stock" },
        { status: 403 }
      )
    }

    const { id } = await params
    const body   = await request.json()

    const parsed = CreateAdjustmentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { type, quantity, direction, reason } = parsed.data

    const product = await prisma.product.findFirst({
      where: { id, businessId: session.user.businessId },
    })
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 })

    // Compute signed delta
    let delta: number
    if (type === "DAMAGE") {
      delta = -quantity
    } else if (type === "RETURN") {
      delta = quantity
    } else {
      delta = direction === "remove" ? -quantity : quantity
    }

    const newStock = product.stock + delta
    if (newStock < 0) {
      return NextResponse.json(
        { error: `Cannot remove ${quantity} — only ${product.stock} in stock` },
        { status: 400 }
      )
    }

    const movement = await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data:  { stock: newStock },
      })
      return tx.stockMovement.create({
        data: {
          type,
          quantity: delta,
          reason,
          productId: id,
          userId:    session.user.id,
        },
        include: { user: { select: { name: true } } },
      })
    })

    return NextResponse.json(serialize(movement), { status: 201 })

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to create adjustment" }, { status: 500 })
  }
}
