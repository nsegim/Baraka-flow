import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CreateCategorySchema } from "@/lib/validators"

// GET /api/categories — all roles
export async function GET() {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const categories = await prisma.category.findMany({
      where:   { businessId: session.user.businessId },
      orderBy: { name: "asc" },
    })

    return NextResponse.json(categories)

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 })
  }
}

// POST /api/categories — OWNER and MANAGER only
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["OWNER", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "You do not have permission to add categories" },
        { status: 403 }
      )
    }

    const body   = await request.json()
    const parsed = CreateCategorySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const category = await prisma.category.create({
      data: {
        name:       parsed.data.name.trim(),
        businessId: session.user.businessId,
      },
    })

    return NextResponse.json(category, { status: 201 })

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 })
  }
}
