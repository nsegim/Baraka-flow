import { NextRequest, NextResponse } from "next/server"
import { serialize } from "@/lib/serialize"
import { requireBranchContext, isBranchContext } from "@/lib/branch-auth"
import { can, type Role } from "@/lib/permissions"
import { OrderService } from "@/modules/order/service"
import { ReturnOrderSchema } from "@/modules/order/schema"

// POST /api/orders/[id]/return — OWNER and MANAGER only
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireBranchContext(request)
    if (!isBranchContext(ctx)) return ctx

    if (!can(ctx.session.user.role as Role, "order:return")) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const { id }   = await params
    const parsed   = ReturnOrderSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const svc    = new OrderService(ctx.session.user.businessId, ctx.session.user.id)
    const result = await svc.processReturn(id, parsed.data)

    return NextResponse.json(serialize(result))
  } catch (error: unknown) {
    const e = error as { name?: string; message?: string }
    if (e?.name === "NotFoundError")   return NextResponse.json({ error: e.message }, { status: 404 })
    if (e?.name === "ValidationError") return NextResponse.json({ error: e.message }, { status: 400 })
    console.error(error)
    return NextResponse.json({ error: "Failed to process return" }, { status: 500 })
  }
}
