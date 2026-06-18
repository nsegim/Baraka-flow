import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CreateSupplierSchema } from "@/lib/validators"

// GET /api/suppliers
export async function GET() {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const suppliers = await prisma.supplier.findMany({
      where:   { businessId: session.user.businessId },
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
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["OWNER", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "You do not have permission to add suppliers" },
        { status: 403 }
      )
    }

    const body   = await request.json()
    const parsed = CreateSupplierSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const supplier = await prisma.supplier.create({
      data: {
        name:       parsed.data.name.trim(),
        email:      parsed.data.email   ?? null,
        phone:      parsed.data.phone   ?? null,
        country:    parsed.data.country ?? null,
        businessId: session.user.businessId,
      },
      include: { _count: { select: { products: true } } },
    })

    return NextResponse.json(supplier, { status: 201 })

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to create supplier" }, { status: 500 })
  }
}
