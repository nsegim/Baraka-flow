import { NextRequest, NextResponse } from "next/server"
import { serialize } from "@/lib/serialize"
import { requireBranchContext, isBranchContext, getWriteBranchId } from "@/lib/branch-auth"
import { can, type Role } from "@/lib/permissions"
import { ProductService } from "@/modules/product/service"
import { UpdateProductSchema } from "@/modules/product/schema"

// PATCH /api/products/[id] — OWNER and MANAGER only
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireBranchContext(request)
    if (!isBranchContext(ctx)) return ctx

    if (!can(ctx.session.user.role as Role, "product:update")) {
      return NextResponse.json({ error: "You do not have permission to edit products" }, { status: 403 })
    }

    const { id }   = await params
    const branchId = getWriteBranchId(ctx, new URL(request.url).searchParams.get("branchId"))

    const parsed = UpdateProductSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const svc     = new ProductService(ctx.session.user.businessId, ctx.session.user.id)
    const updated = await svc.update(id, parsed.data, branchId)

    return NextResponse.json(serialize(updated))
  } catch (error: unknown) {
    const e = error as { name?: string; message?: string }
    if (e?.name === "NotFoundError") return NextResponse.json({ error: e.message }, { status: 404 })
    console.error("PATCH /api/products/[id] error:", error)
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 })
  }
}

// DELETE /api/products/[id] — OWNER only
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireBranchContext(request)
    if (!isBranchContext(ctx)) return ctx

    if (!can(ctx.session.user.role as Role, "product:delete")) {
      return NextResponse.json({ error: "Only the account owner can delete products" }, { status: 403 })
    }

    const { id } = await params
    const svc    = new ProductService(ctx.session.user.businessId, ctx.session.user.id)
    await svc.delete(id)

    return NextResponse.json({ message: "Product deleted successfully" })
  } catch (error: unknown) {
    const e = error as { name?: string; message?: string }
    if (e?.name === "NotFoundError") return NextResponse.json({ error: e.message }, { status: 404 })
    console.error("DELETE /api/products/[id] error:", error)
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 })
  }
}
