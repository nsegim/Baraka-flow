import { NextRequest, NextResponse } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import { serialize } from "@/lib/serialize"

// GET /api/admin/platform-logs — paginated platform audit log
export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = request.nextUrl
  const action = searchParams.get("action") ?? ""
  const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
  const limit  = 30
  const skip   = (page - 1) * limit

  const where = action ? { action: action as never } : {}

  const [logs, total] = await prisma.$transaction([
    prisma.platformAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true, action: true, entityType: true, entityId: true,
        metadata: true, ipAddress: true, createdAt: true,
        platformUser: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.platformAuditLog.count({ where }),
  ])

  return NextResponse.json(serialize({
    data: logs,
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  }))
}
