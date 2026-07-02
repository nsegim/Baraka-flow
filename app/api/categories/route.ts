import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { CreateCategorySchema } from "@/lib/validators"
import { requireBranchContext, isBranchContext } from "@/lib/branch-auth"
import { can, type Role } from "@/lib/permissions"

// GET /api/categories — all roles
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireBranchContext(request)
    if (!isBranchContext(ctx)) return ctx

    const categories = await prisma.category.findMany({
      where:   { businessId: ctx.session.user.businessId },
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
    const ctx = await requireBranchContext(request)
    if (!isBranchContext(ctx)) return ctx

    if (!can(ctx.session.user.role as Role, "category:create")) {
      return NextResponse.json({ error: "You do not have permission to add categories" }, { status: 403 })
    }

    const parsed = CreateCategorySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const category = await prisma.category.create({
      data: {
        name:       parsed.data.name.trim(),
        businessId: ctx.session.user.businessId,
      },
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 })
  }
}
