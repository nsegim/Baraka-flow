import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { CreateCustomerSchema } from "@/lib/validators"
import { serialize } from "@/lib/serialize"
import { requireBranchContext, isBranchContext } from "@/lib/branch-auth"
import { can, type Role } from "@/lib/permissions"

// GET /api/customers — all roles
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireBranchContext(request)
    if (!isBranchContext(ctx)) return ctx

    const sp    = request.nextUrl.searchParams
    const page  = Math.max(1, parseInt(sp.get("page")  ?? "1"))
    const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") ?? "50")))
    const q     = sp.get("q")?.trim()

    const where = {
      businessId: ctx.session.user.businessId,
      ...(q ? {
        OR: [
          { name:  { contains: q, mode: "insensitive" as const } },
          { phone: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
        ],
      } : {}),
    }

    const [customers, total] = await prisma.$transaction([
      prisma.customer.findMany({
        where,
        include: { _count: { select: { orders: true } } },
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      prisma.customer.count({ where }),
    ])

    return NextResponse.json({
      data: serialize(customers),
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 })
  }
}

// POST /api/customers — OWNER, MANAGER, STAFF
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireBranchContext(request)
    if (!isBranchContext(ctx)) return ctx

    if (!can(ctx.session.user.role as Role, "customer:create")) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const parsed = CreateCustomerSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const customer = await prisma.customer.create({
      data: {
        name:       parsed.data.name.trim(),
        phone:      parsed.data.phone   ?? null,
        email:      parsed.data.email   ?? null,
        address:    parsed.data.address ?? null,
        notes:      parsed.data.notes   ?? null,
        businessId: ctx.session.user.businessId,
      },
      include: { _count: { select: { orders: true } } },
    })

    return NextResponse.json(serialize(customer), { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 })
  }
}
