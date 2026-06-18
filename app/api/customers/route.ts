import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CreateCustomerSchema } from "@/lib/validators"
import { serialize } from "@/lib/serialize"

// GET /api/customers — paginated, all roles can view
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = request.nextUrl
    const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1"))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50")))
    const skip  = (page - 1) * limit
    const q     = searchParams.get("q")?.trim()

    const where = {
      businessId: session.user.businessId,
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
        skip,
        take: limit,
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

// POST /api/customers — OWNER and MANAGER only
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!["OWNER", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const body   = await request.json()
    const parsed = CreateCustomerSchema.safeParse(body)
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
        businessId: session.user.businessId,
      },
      include: { _count: { select: { orders: true } } },
    })

    return NextResponse.json(serialize(customer), { status: 201 })

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 })
  }
}
