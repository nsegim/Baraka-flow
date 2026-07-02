import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { CreateSupplierSchema } from "@/lib/validators"
import { requireBranchContext, isBranchContext } from "@/lib/branch-auth"
import { can, type Role } from "@/lib/permissions"

// GET /api/suppliers — all roles
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireBranchContext(request)
    if (!isBranchContext(ctx)) return ctx

    const suppliers = await prisma.supplier.findMany({
      where:   { businessId: ctx.session.user.businessId },
      include: { _count: { select: { products: true } } },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(suppliers)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to fetch suppliers" }, { status: 500 })
  }
}

// POST /api/suppliers — OWNER and MANAGER only
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireBranchContext(request)
    if (!isBranchContext(ctx)) return ctx

    if (!can(ctx.session.user.role as Role, "supplier:create")) {
      return NextResponse.json({ error: "You do not have permission to add suppliers" }, { status: 403 })
    }

    const parsed = CreateSupplierSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const supplier = await prisma.supplier.create({
      data: {
        name:       parsed.data.name.trim(),
        email:      parsed.data.email   ?? null,
        phone:      parsed.data.phone   ?? null,
        country:    parsed.data.country ?? null,
        businessId: ctx.session.user.businessId,
      },
      include: { _count: { select: { products: true } } },
    })

    return NextResponse.json(supplier, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to create supplier" }, { status: 500 })
  }
}
