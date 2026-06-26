import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CreateBranchSchema } from "@/lib/validators"
import { serialize } from "@/lib/serialize"
import { createAuditLog } from "@/lib/audit"
import { getIp } from "@/lib/rate-limit"

// GET /api/branches — list all branches for this business (OWNER only)
export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Only owners can manage branches" }, { status: 403 })
    }

    const branches = await prisma.branch.findMany({
      where:   { businessId: session.user.businessId },
      include: {
        _count: {
          select: { users: true, orders: true, inventory: true },
        },
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    })

    return NextResponse.json(serialize(branches))
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to fetch branches" }, { status: 500 })
  }
}

// POST /api/branches — create a new branch (OWNER only)
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Only owners can create branches" }, { status: 403 })
    }

    const body   = await request.json()
    const parsed = CreateBranchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    // Enforce unique code within this business
    const existing = await prisma.branch.findUnique({
      where: { businessId_code: { businessId: session.user.businessId, code: parsed.data.code } },
    })
    if (existing) {
      return NextResponse.json(
        { error: `Branch code "${parsed.data.code}" is already in use` },
        { status: 409 }
      )
    }

    const branch = await prisma.branch.create({
      data: {
        name:       parsed.data.name,
        code:       parsed.data.code,
        address:    parsed.data.address ?? null,
        phone:      parsed.data.phone   ?? null,
        businessId: session.user.businessId,
      },
      include: {
        _count: { select: { users: true, orders: true, inventory: true } },
      },
    })

    // Seed BranchInventory rows for all existing products
    const products = await prisma.product.findMany({
      where:  { businessId: session.user.businessId },
      select: { id: true },
    })
    if (products.length > 0) {
      await prisma.branchInventory.createMany({
        data: products.map(p => ({
          branchId:  branch.id,
          productId: p.id,
          stock:     0,
          minStock:  5,
        })),
        skipDuplicates: true,
      })
    }

    createAuditLog({
      businessId: session.user.businessId,
      userId:     session.user.id,
      action:     "BRANCH_CREATED",
      entityType: "Branch",
      entityId:   branch.id,
      metadata:   { name: branch.name, code: branch.code },
      ipAddress:  getIp(request),
    })

    return NextResponse.json(serialize(branch), { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to create branch" }, { status: 500 })
  }
}
