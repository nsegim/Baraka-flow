import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UpdateUserRoleSchema } from "@/lib/validators"

// PATCH /api/users/[id] — change role or deactivate (OWNER only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Only the account owner can modify staff roles" }, { status: 403 })
    }

    const { id } = await params

    if (id === session.user.id) {
      return NextResponse.json({ error: "You cannot change your own role" }, { status: 400 })
    }

    const body = await request.json()

    // Allow either role change or isActive toggle
    if ("isActive" in body) {
      const target = await prisma.user.findFirst({
        where: { id, businessId: session.user.businessId },
      })
      if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 })

      const updated = await prisma.user.update({
        where:  { id },
        data:   { isActive: Boolean(body.isActive) },
        select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      })
      return NextResponse.json(updated)
    }

    const parsed = UpdateUserRoleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const target = await prisma.user.findFirst({
      where: { id, businessId: session.user.businessId },
    })
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 })

    if (target.role === "OWNER") {
      return NextResponse.json({ error: "Cannot change the owner's role" }, { status: 400 })
    }

    const updated = await prisma.user.update({
      where:  { id },
      data:   { role: parsed.data.role },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    })

    return NextResponse.json(updated)

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }
}

// DELETE /api/users/[id] — remove staff member (OWNER only)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Only the account owner can remove staff" }, { status: 403 })
    }

    const { id } = await params

    if (id === session.user.id) {
      return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 })
    }

    const target = await prisma.user.findFirst({
      where: { id, businessId: session.user.businessId },
    })
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 })

    if (target.role === "OWNER") {
      return NextResponse.json({ error: "Cannot delete the owner account" }, { status: 400 })
    }

    await prisma.user.delete({ where: { id } })

    return NextResponse.json({ message: "Staff member removed" })

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 })
  }
}
