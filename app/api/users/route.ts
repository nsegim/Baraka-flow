import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CreateStaffSchema } from "@/lib/validators"
import bcrypt from "bcryptjs"
import { createAuditLog } from "@/lib/audit"
import { getIp } from "@/lib/rate-limit"
import { checkPlanLimit } from "@/lib/plan-limits"

// GET /api/users — list all staff for this business (OWNER only)
export async function GET(_request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Only the account owner can view staff" }, { status: 403 })
    }

    const users = await prisma.user.findMany({
      where:   { businessId: session.user.businessId },
      select:  {
        id:        true,
        name:      true,
        email:     true,
        role:      true,
        isActive:  true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json(users)

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
  }
}

// POST /api/users — create a new staff member (OWNER only)
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Only the account owner can create staff accounts" }, { status: 403 })
    }

    const body   = await request.json()
    const parsed = CreateStaffSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    // Plan enforcement
    const limitCheck = await checkPlanLimit(session.user.businessId, "users")
    if (!limitCheck.allowed) {
      return NextResponse.json({ error: limitCheck.error }, { status: 403 })
    }

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } })
    if (existing) {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 })
    }

    const hashed = await bcrypt.hash(parsed.data.password, 12)

    const user = await prisma.user.create({
      data: {
        name:       parsed.data.name,
        email:      parsed.data.email,
        password:   hashed,
        role:       parsed.data.role,
        businessId: session.user.businessId,
      },
      select: {
        id: true, name: true, email: true, role: true, isActive: true, createdAt: true,
      },
    })

    createAuditLog({
      businessId: session.user.businessId,
      userId:     session.user.id,
      action:     "USER_CREATED",
      entityType: "User",
      entityId:   user.id,
      metadata:   { name: user.name, email: user.email, role: user.role },
      ipAddress:  getIp(request),
    })

    return NextResponse.json(user, { status: 201 })

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to create staff member" }, { status: 500 })
  }
}
