import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { can, type Role } from "@/lib/permissions"
import { UserService } from "@/modules/user/service"
import { CreateStaffSchema } from "@/lib/validators"

// GET /api/users — OWNER only
export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!can(session.user.role as Role, "user:create")) {
      return NextResponse.json({ error: "Only the account owner can view staff" }, { status: 403 })
    }

    const svc   = new UserService(session.user.businessId, session.user.id)
    const users = await svc.list()

    return NextResponse.json(users)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
  }
}

// POST /api/users — OWNER only
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!can(session.user.role as Role, "user:create")) {
      return NextResponse.json({ error: "Only the account owner can create staff accounts" }, { status: 403 })
    }

    const parsed = CreateStaffSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const svc  = new UserService(session.user.businessId, session.user.id)
    const user = await svc.create(parsed.data)

    return NextResponse.json(user, { status: 201 })
  } catch (error: unknown) {
    const e = error as { name?: string; message?: string }
    if (e?.name === "ValidationError") return NextResponse.json({ error: e.message }, { status: 409 })
    console.error(error)
    return NextResponse.json({ error: "Failed to create staff member" }, { status: 500 })
  }
}
