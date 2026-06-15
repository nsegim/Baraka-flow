import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET — fetch all suppliers
export async function GET() {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const suppliers = await prisma.supplier.findMany({
      where:   { businessId: session.user.businessId },
      include: {
        // Count how many products this supplier provides
        _count: { select: { products: true } }
      },
      orderBy: { createdAt: "desc" }
    })

    return NextResponse.json(suppliers)

  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Failed to fetch suppliers" },
      { status: 500 }
    )
  }
}

// POST — create a new supplier
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, email, phone, country } = body

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Supplier name is required" },
        { status: 400 }
      )
    }

    const supplier = await prisma.supplier.create({
      data: {
        name:       name.trim(),
        email:      email   || null,
        phone:      phone   || null,
        country:    country || null,
        businessId: session.user.businessId
      },
      include: {
        _count: { select: { products: true } }
      }
    })

    return NextResponse.json(supplier, { status: 201 })

  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Failed to create supplier" },
      { status: 500 }
    )
  }
}