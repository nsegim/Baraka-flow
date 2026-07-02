import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UpdateExpenseSchema } from "@/lib/validators"
import { serialize } from "@/lib/serialize"
import { requireBranchContext, isBranchContext } from "@/lib/branch-auth"
import { can, type Role } from "@/lib/permissions"

// PATCH /api/expenses/[id] — OWNER and MANAGER only
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireBranchContext(request)
    if (!isBranchContext(ctx)) return ctx

    if (!can(ctx.session.user.role as Role, "expense:update")) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const { id }   = await params
    const parsed   = UpdateExpenseSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const existing = await prisma.expense.findFirst({
      where: { id, businessId: ctx.session.user.businessId },
    })
    if (!existing) return NextResponse.json({ error: "Expense not found" }, { status: 404 })

    const updated = await prisma.expense.update({
      where: { id },
      data: {
        title:    parsed.data.title    ?? existing.title,
        amount:   parsed.data.amount   ?? existing.amount,
        category: parsed.data.category ?? existing.category,
        date:     parsed.data.date ? new Date(parsed.data.date) : existing.date,
        notes:    parsed.data.notes    ?? existing.notes,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    })

    return NextResponse.json(serialize(updated))
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to update expense" }, { status: 500 })
  }
}

// DELETE /api/expenses/[id] — OWNER and MANAGER only
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireBranchContext(_request)
    if (!isBranchContext(ctx)) return ctx

    if (!can(ctx.session.user.role as Role, "expense:delete")) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const { id }   = await params
    const existing = await prisma.expense.findFirst({
      where: { id, businessId: ctx.session.user.businessId },
    })
    if (!existing) return NextResponse.json({ error: "Expense not found" }, { status: 404 })

    await prisma.expense.delete({ where: { id } })

    return NextResponse.json({ message: "Expense deleted" })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 })
  }
}
