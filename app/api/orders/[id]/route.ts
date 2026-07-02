import { NextRequest, NextResponse } from "next/server"
import { serialize } from "@/lib/serialize"
import { requireBranchContext, isBranchContext } from "@/lib/branch-auth"
import { can, type Role } from "@/lib/permissions"
import { OrderService } from "@/modules/order/service"
import { UpdateOrderStatusSchema } from "@/modules/order/schema"

// GET /api/orders/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireBranchContext(request)
    if (!isBranchContext(ctx)) return ctx

    const { id } = await params
    const svc    = new OrderService(ctx.session.user.businessId, ctx.session.user.id)
    const order  = await svc.getById(id, ctx.branchId)

    return NextResponse.json(serialize(order))
  } catch (error: unknown) {
    const e = error as { name?: string; message?: string }
    if (e?.name === "NotFoundError") return NextResponse.json({ error: e.message }, { status: 404 })
    console.error(error)
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 })
  }
}

// PATCH /api/orders/[id] — OWNER and MANAGER only
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireBranchContext(request)
    if (!isBranchContext(ctx)) return ctx

    if (!can(ctx.session.user.role as Role, "order:update")) {
      return NextResponse.json({ error: "You do not have permission to update orders" }, { status: 403 })
    }

    const { id }   = await params
    const parsed   = UpdateOrderStatusSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const svc     = new OrderService(ctx.session.user.businessId, ctx.session.user.id)
    const updated = await svc.updateStatus(id, parsed.data, ctx.branchId)

    return NextResponse.json(serialize(updated))
  } catch (error: unknown) {
    const e = error as { name?: string; message?: string }
    if (e?.name === "NotFoundError")   return NextResponse.json({ error: e.message }, { status: 404 })
    if (e?.name === "ValidationError") return NextResponse.json({ error: e.message }, { status: 400 })
    console.error(error)
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 })
  }
}

// DELETE /api/orders/[id] — OWNER only
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireBranchContext(request)
    if (!isBranchContext(ctx)) return ctx

    if (!can(ctx.session.user.role as Role, "order:delete")) {
      return NextResponse.json({ error: "Only the account owner can delete orders" }, { status: 403 })
    }

    const { id } = await params
    const svc    = new OrderService(ctx.session.user.businessId, ctx.session.user.id)
    await svc.delete(id)

    return NextResponse.json({ message: "Order deleted" })
  } catch (error: unknown) {
    const e = error as { name?: string; message?: string }
    if (e?.name === "NotFoundError")   return NextResponse.json({ error: e.message }, { status: 404 })
    if (e?.name === "ValidationError") return NextResponse.json({ error: e.message }, { status: 400 })
    console.error(error)
    return NextResponse.json({ error: "Failed to delete order" }, { status: 500 })
  }
}
