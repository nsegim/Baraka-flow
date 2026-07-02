import { NextRequest, NextResponse } from "next/server"
import { serialize } from "@/lib/serialize"
import { requireBranchContext, isBranchContext, getWriteBranchId } from "@/lib/branch-auth"
import { can } from "@/lib/permissions"
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit"
import { ProductService, withStockSummary } from "@/modules/product/service"
import { CreateProductSchema } from "@/modules/product/schema"

// GET /api/products — paginated or ?all=true for dropdowns
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireBranchContext(request)
    if (!isBranchContext(ctx)) return ctx

    const sp         = request.nextUrl.searchParams
    const fetchAll   = sp.get("all") === "true"
    const page       = Math.max(1, parseInt(sp.get("page")  ?? "1"))
    const limit      = Math.min(100, Math.max(1, parseInt(sp.get("limit") ?? "50")))
    const search     = sp.get("search")?.trim()
    const categoryId = sp.get("categoryId") ?? undefined
    const supplierId = sp.get("supplierId") ?? undefined

    const svc = new ProductService(ctx.session.user.businessId, ctx.session.user.id)

    if (fetchAll) {
      const products = await svc.listAll(ctx.branchId, search)
      return NextResponse.json(serialize(withStockSummary(products, ctx.branchId)))
    }

    const [products, total] = await svc.list({ branchId: ctx.branchId, page, limit, search, categoryId, supplierId })
    return NextResponse.json({
      data: serialize(withStockSummary(products, ctx.branchId)),
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error("GET /api/products error:", error)
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 })
  }
}

// POST /api/products — OWNER and MANAGER only
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireBranchContext(request, { requireBranch: true })
    if (!isBranchContext(ctx)) return ctx

    if (!can(ctx.session.user.role as "OWNER" | "MANAGER" | "STAFF", "product:create")) {
      return NextResponse.json({ error: "You do not have permission to add products" }, { status: 403 })
    }

    // 30 product creates per minute per business — prevents bulk script abuse
    const rl = rateLimit(`product:create:${ctx.session.user.businessId}`, 60_000, 30)
    if (!rl.success) return rateLimitResponse(rl)

    const branchId = getWriteBranchId(ctx, new URL(request.url).searchParams.get("branchId"))
    if (!branchId) {
      return NextResponse.json({ error: "Select a branch before adding products" }, { status: 400 })
    }

    const parsed = CreateProductSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const svc     = new ProductService(ctx.session.user.businessId, ctx.session.user.id)
    const product = await svc.create(parsed.data, branchId)

    return NextResponse.json(
      serialize({ ...product, stock: parsed.data.stock ?? 0, minStock: parsed.data.minStock ?? 5 }),
      { status: 201 },
    )
  } catch (error: unknown) {
    const e = error as { name?: string; message?: string; status?: number }
    if (e?.name === "PlanLimitError") return NextResponse.json({ error: e.message }, { status: 402 })
    console.error("POST /api/products error:", error)
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 })
  }
}
