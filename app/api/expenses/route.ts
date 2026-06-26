import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { CreateExpenseSchema } from "@/lib/validators"
import { serialize } from "@/lib/serialize"
import { createAuditLog } from "@/lib/audit"
import { getIp } from "@/lib/rate-limit"
import { requireBranchContext, isBranchContext, buildBranchWhere, getWriteBranchId } from "@/lib/branch-auth"

// GET /api/expenses — paginated, branch-scoped
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireBranchContext(request)
    if (!isBranchContext(ctx)) return ctx

    const { searchParams } = request.nextUrl
    const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1"))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50")))
    const skip  = (page - 1) * limit
    const month = searchParams.get("month")

    const where: Record<string, unknown> = buildBranchWhere(ctx)
    if (month) {
      const [year, mon] = month.split("-").map(Number)
      where.date = { gte: new Date(year, mon - 1, 1), lt: new Date(year, mon, 1) }
    }

    const [expenses, total] = await prisma.$transaction([
      prisma.expense.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true } },
          branch:    { select: { name: true, code: true } },
        },
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

// POST /api/expenses — OWNER and MANAGER only
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireBranchContext(request, { requireBranch: true })
    if (!isBranchContext(ctx)) return ctx

    if (!["OWNER", "MANAGER"].includes(ctx.session.user.role)) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const branchId = getWriteBranchId(ctx, new URL(request.url).searchParams.get("branchId"))
    if (!branchId) {
      return NextResponse.json({ error: "Select a branch before adding an expense" }, { status: 400 })
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
        businessId:  ctx.session.user.businessId,
        branchId,
        createdById: ctx.session.user.id,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        branch:    { select: { name: true, code: true } },
      },
    })

    createAuditLog({
      businessId: ctx.session.user.businessId,
      branchId,
      userId:     ctx.session.user.id,
      action:     "EXPENSE_CREATED",
      entityType: "Expense",
      entityId:   expense.id,
      metadata:   { title: expense.title, amount: Number(expense.amount), category: expense.category },
      ipAddress:  getIp(request),
    })

    return NextResponse.json(serialize(expense), { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 })
  }
}
