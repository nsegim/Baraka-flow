import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AssignBranchUserSchema } from "@/lib/validators"
import { serialize } from "@/lib/serialize"
import { createAuditLog } from "@/lib/audit"
import { getIp } from "@/lib/rate-limit"

// POST /api/branches/[id]/users — assign a user to this branch (OWNER only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Only owners can assign staff to branches" }, { status: 403 })
    }

    const { id: branchId } = await params

    const branch = await prisma.branch.findFirst({
      where: { id: branchId, businessId: session.user.businessId },
    })
    if (!branch) return NextResponse.json({ error: "Branch not found" }, { status: 404 })

    const body   = await request.json()
    const parsed = AssignBranchUserSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    // Confirm user belongs to this business
    const user = await prisma.user.findFirst({
      where: { id: parsed.data.userId, businessId: session.user.businessId },
      select: { id: true, name: true, role: true },
    })
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
    if (user.role === "OWNER") {
      return NextResponse.json({ error: "Owners have access to all branches and cannot be assigned" }, { status: 400 })
    }

    const assignment = await prisma.branchUser.upsert({
      where:  { userId_branchId: { userId: user.id, branchId } },
      create: { userId: user.id, branchId },
      update: {},
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    })

    createAuditLog({
      businessId: session.user.businessId,
      branchId,
      userId:     session.user.id,
      action:     "BRANCH_USER_ASSIGNED",
      entityType: "BranchUser",
      entityId:   assignment.id,
      metadata:   { userName: user.name, branchName: branch.name },
      ipAddress:  getIp(request),
    })

    return NextResponse.json(serialize(assignment), { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to assign user to branch" }, { status: 500 })
  }
}

// DELETE /api/branches/[id]/users?userId=xxx — remove user from branch (OWNER only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Only owners can remove staff from branches" }, { status: 403 })
    }

    const { id: branchId } = await params
    const userId = new URL(request.url).searchParams.get("userId")
    if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 })

    const branch = await prisma.branch.findFirst({
      where: { id: branchId, businessId: session.user.businessId },
    })
    if (!branch) return NextResponse.json({ error: "Branch not found" }, { status: 404 })

    const assignment = await prisma.branchUser.findUnique({
      where: { userId_branchId: { userId, branchId } },
      include: { user: { select: { name: true } } },
    })
    if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 })

    await prisma.branchUser.delete({
      where: { userId_branchId: { userId, branchId } },
    })

    createAuditLog({
      businessId: session.user.businessId,
      branchId,
      userId:     session.user.id,
      action:     "BRANCH_USER_REMOVED",
      entityType: "BranchUser",
      metadata:   { userName: assignment.user.name, branchName: branch.name },
      ipAddress:  getIp(request),
    })

    return NextResponse.json({ message: "User removed from branch" })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to remove user from branch" }, { status: 500 })
  }
}
