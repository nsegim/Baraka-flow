import { NextRequest, NextResponse } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import { serialize } from "@/lib/serialize"

// GET /api/admin/users — all users across all tenants
export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = request.nextUrl
  const search = searchParams.get("search") ?? ""
  const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
  const limit  = 30
  const skip   = (page - 1) * limit

  const where = search
    ? {
        OR: [
          { name:  { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
          { business: { name: { contains: search, mode: "insensitive" as const } } },
        ],
      }
    : {}

  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true, name: true, email: true,
        role: true, isActive: true, createdAt: true,
        business: { select: { id: true, name: true, email: true, status: true } },
      },
    }),
    prisma.user.count({ where }),
  ])

  return NextResponse.json(serialize({
    data: users,
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  }))
}
