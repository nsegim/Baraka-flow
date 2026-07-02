import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { CreateExpenseSchema } from "@/lib/validators"
import { serialize } from "@/lib/serialize"
import { createAuditLog } from "@/lib/audit"
import { requireBranchContext, isBranchContext, buildBranchWhere, getWriteBranchId } from "@/lib/branch-auth"
import { can, type Role } from "@/lib/permissions"

// GET /api/expenses — paginated, branch-scoped
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireBranchContext(request)
    if (!isBranchContext(ctx)) return ctx

    const sp    = request.nextUrl.searchParams
    const page  = Math.max(1, parseInt(sp.get("page")  ?? "1"))
    const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") ?? "50")))
    const month = sp.get("month")
    const cat   = sp.get("category")

    const where: Record<string, unknown> = buildBranchWhere(ctx)
    if (month) {
      const [year, mon] = month.split("-").map(Number)
      where.date = { gte: new Date(year, mon - 1, 1), lt: new Date(year, mon, 1) }
    }
    if (cat) where.category = cat

    const [expenses, total] = await prisma.$transaction([
      prisma.expense.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true } },
          branch:    { select: { name: true, code: true } },
        },
        orderBy: { date: "desc" },
        skip:    (page - 1) * limit,
        take:    limit,
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

    if (!can(ctx.session.user.role as Role, "expense:create")) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const branchId = getWriteBranchId(ctx, new URL(request.url).searchParams.get("branchId"))
    if (!branchId) {
      return NextResponse.json({ error: "Select a branch before adding an expense" }, { status: 400 })
    }

    const parsed = CreateExpenseSchema.safeParse(await request.json())
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
    })

    return NextResponse.json(serialize(expense), { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 })
  }
}
