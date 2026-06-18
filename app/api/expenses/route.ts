import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CreateExpenseSchema } from "@/lib/validators"
import { serialize } from "@/lib/serialize"

// GET /api/expenses — paginated, with optional ?month=YYYY-MM filter
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = request.nextUrl
    const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1"))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50")))
    const skip  = (page - 1) * limit
    const month = searchParams.get("month") // e.g. "2025-06"

    const where: Record<string, unknown> = { businessId: session.user.businessId }

    if (month) {
      const [year, mon] = month.split("-").map(Number)
      const start = new Date(year, mon - 1, 1)
      const end   = new Date(year, mon, 1)
      where.date  = { gte: start, lt: end }
    }

    const [expenses, total] = await prisma.$transaction([
      prisma.expense.findMany({
        where,
        include: { createdBy: { select: { id: true, name: true } } },
        orderBy: { date: "desc" },
        skip,
        take: limit,
      }),
      prisma.expense.count({ where }),
    ])

    return NextResponse.json({
      data: serialize(expenses),
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    })

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 })
  }
}

// POST /api/expenses — OWNER and MANAGER
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!["OWNER", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const body   = await request.json()
    const parsed = CreateExpenseSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const expense = await prisma.expense.create({
      data: {
        title:       parsed.data.title,
        amount:      parsed.data.amount,
        category:    parsed.data.category,
        date:        new Date(parsed.data.date),
        notes:       parsed.data.notes ?? null,
        businessId:  session.user.businessId,
        createdById: session.user.id,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    })

    return NextResponse.json(serialize(expense), { status: 201 })

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 })
  }
}
