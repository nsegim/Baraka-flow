import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { can, type Role } from "@/lib/permissions"
import { UserService } from "@/modules/user/service"
import { UpdateUserRoleSchema } from "@/lib/validators"

// PATCH /api/users/[id] — change role or toggle isActive (OWNER only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!can(session.user.role as Role, "user:update")) {
      return NextResponse.json({ error: "Only the account owner can modify staff" }, { status: 403 })
    }

    const { id }   = await params
    const body     = await request.json()
    const svc      = new UserService(session.user.businessId, session.user.id)

    if ("isActive" in body) {
      const updated = await svc.setActive(id, Boolean(body.isActive))
      return NextResponse.json(updated)
    }

    const parsed = UpdateUserRoleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const updated = await svc.updateRole(id, parsed.data.role)
    return NextResponse.json(updated)
  } catch (error: unknown) {
    const e = error as { name?: string; message?: string }
    if (e?.name === "NotFoundError")   return NextResponse.json({ error: e.message }, { status: 404 })
    if (e?.name === "ForbiddenError")  return NextResponse.json({ error: e.message }, { status: 403 })
    if (e?.name === "ValidationError") return NextResponse.json({ error: e.message }, { status: 400 })
    console.error(error)
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }
}

// DELETE /api/users/[id] — OWNER only
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!can(session.user.role as Role, "user:delete")) {
      return NextResponse.json({ error: "Only the account owner can remove staff" }, { status: 403 })
    }

    const { id } = await params
    const svc    = new UserService(session.user.businessId, session.user.id)
    await svc.delete(id)

    return NextResponse.json({ message: "Staff member removed" })
  } catch (error: unknown) {
    const e = error as { name?: string; message?: string }
    if (e?.name === "NotFoundError")   return NextResponse.json({ error: e.message }, { status: 404 })
    if (e?.name === "ForbiddenError")  return NextResponse.json({ error: e.message }, { status: 403 })
    if (e?.name === "ValidationError") return NextResponse.json({ error: e.message }, { status: 400 })
    console.error(error)
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 })
  }
}
