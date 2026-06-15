import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET — fetch all categories
export async function GET() {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const categories = await prisma.category.findMany({
      where:   { businessId: session.user.businessId },
      orderBy: { name: "asc" }
    })

    return NextResponse.json(categories)

  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    )
  }
}

// POST — create a new category
export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { name } = await request.json()

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      )
    }

    const category = await prisma.category.create({
      data: {
        name:       name.trim(),
        businessId: session.user.businessId
      }
    })

    return NextResponse.json(category, { status: 201 })

  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    )
  }
}