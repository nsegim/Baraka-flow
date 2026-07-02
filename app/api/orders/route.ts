import { NextRequest, NextResponse } from "next/server"
import { serialize } from "@/lib/serialize"
import { requireBranchContext, isBranchContext, getWriteBranchId } from "@/lib/branch-auth"
import { can, type Role } from "@/lib/permissions"
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit"
import { prisma } from "@/lib/prisma"
import { OrderService } from "@/modules/order/service"
import { CreateOrderSchema } from "@/modules/order/schema"

// GET /api/orders — paginated, branch-scoped
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireBranchContext(request)
    if (!isBranchContext(ctx)) return ctx

    const sp = request.nextUrl.searchParams
    const page   = Math.max(1, parseInt(sp.get("page")  ?? "1"))
    const limit  = Math.min(100, Math.max(1, parseInt(sp.get("limit") ?? "50")))

    const svc = new OrderService(ctx.session.user.businessId, ctx.session.user.id)
    const [orders, total] = await svc.list({
      branchId:      ctx.branchId,
      page,
      limit,
      status:        sp.get("status")        ?? undefined,
      paymentStatus: sp.get("paymentStatus") ?? undefined,
      month:         sp.get("month")         ?? undefined,
      search:        sp.get("search")?.trim() ?? undefined,
    })

    return NextResponse.json({
      data: serialize(orders),
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 })
  }
}

// POST /api/orders — OWNER, MANAGER, STAFF can create orders
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireBranchContext(request, { requireBranch: true })
    if (!isBranchContext(ctx)) return ctx

    if (!can(ctx.session.user.role as Role, "order:create")) {
      return NextResponse.json({ error: "You do not have permission to create orders" }, { status: 403 })
    }

    // 60 orders per minute per business — prevents runaway scripting/duplicate submissions
    const rl = rateLimit(`order:create:${ctx.session.user.businessId}`, 60_000, 60)
    if (!rl.success) return rateLimitResponse(rl)

    const branchId = getWriteBranchId(ctx, new URL(request.url).searchParams.get("branchId"))
    if (!branchId) {
      return NextResponse.json({ error: "Select a branch before creating an order" }, { status: 400 })
    }

    const branch = await prisma.branch.findFirst({
      where:  { id: branchId, businessId: ctx.session.user.businessId, isActive: true },
      select: { id: true, name: true, code: true },
    })
    if (!branch) return NextResponse.json({ error: "Branch not found" }, { status: 404 })

    const parsed = CreateOrderSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const svc = new OrderService(ctx.session.user.businessId, ctx.session.user.id)
    const { order, warnings } = await svc.create(parsed.data, branchId, branch.name, branch.code)

    const body = serialize(order) as Record<string, unknown>
    if (warnings.length > 0) body.warnings = warnings

    return NextResponse.json(body, { status: 201 })
  } catch (error: unknown) {
    const e = error as { name?: string; message?: string }
    if (e?.name === "PlanLimitError")  return NextResponse.json({ error: e.message }, { status: 402 })
    if (e?.name === "ValidationError") return NextResponse.json({ error: e.message }, { status: 400 })
    console.error(error)
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 })
  }
}
