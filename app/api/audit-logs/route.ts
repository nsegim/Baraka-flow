import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { serialize } from "@/lib/serialize"

// GET /api/audit-logs — OWNER only, paginated, filterable
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Audit logs are sensitive — OWNER only
    if (session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Only the account owner can view audit logs" }, { status: 403 })
    }

    const { searchParams } = request.nextUrl
    const page      = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
    const limit     = 50
    const skip      = (page - 1) * limit
    const action    = searchParams.get("action")    // filter by AuditAction enum value
    const entityType = searchParams.get("entityType") // filter by entity type

    const where = {
      businessId: session.user.businessId,
      ...(action     ? { action:     action as never    } : {}),
      ...(entityType ? { entityType: entityType         } : {}),
    }

    const [logs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take:    limit,
        include: {
          user: { select: { name: true, email: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ])

    return NextResponse.json(serialize({
      data: logs,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    }))
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 })
  }
}
