import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UpdateExpenseSchema } from "@/lib/validators"
import { serialize } from "@/lib/serialize"

// PATCH /api/expenses/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!["OWNER", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const { id } = await params
    const body   = await request.json()

    const parsed = UpdateExpenseSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const existing = await prisma.expense.findFirst({
      where: { id, businessId: session.user.businessId },
    })
    if (!existing) return NextResponse.json({ error: "Expense not found" }, { status: 404 })

    const updated = await prisma.expense.update({
      where: { id },
      data:  {
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

// DELETE /api/expenses/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!["OWNER", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const { id } = await params

    const existing = await prisma.expense.findFirst({
      where: { id, businessId: session.user.businessId },
    })
    if (!existing) return NextResponse.json({ error: "Expense not found" }, { status: 404 })

    await prisma.expense.delete({ where: { id } })

    return NextResponse.json({ message: "Expense deleted" })

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 })
  }
}
