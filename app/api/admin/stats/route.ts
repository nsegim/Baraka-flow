import { NextResponse } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import { serialize } from "@/lib/serialize"

// GET /api/admin/stats
// Platform metadata ONLY — counts, signups, and active support sessions.
// No tenant financial data (revenue, orders, expenses, customers, etc.)
export async function GET() {
  const auth = await requireSuperAdmin()
  if (auth instanceof NextResponse) return auth

  const [
    totalBusinesses,
    activeBusinesses,
    suspendedBusinesses,
    totalUsers,
    activeSupportSessions,
    recentBusinesses,
    monthlySignups,
  ] = await Promise.all([
    prisma.business.count(),
    prisma.business.count({ where: { status: "ACTIVE" } }),
    prisma.business.count({ where: { status: "SUSPENDED" } }),
    prisma.user.count(),
    prisma.supportSession.count({
      where: { status: "ACTIVE", expiresAt: { gt: new Date() } },
    }),
    prisma.business.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true, name: true, email: true, status: true,
        plan: true, createdAt: true,
        _count: { select: { users: true, branches: true } },
      },
    }),
    prisma.$queryRaw<{ month: string; count: string }[]>`
      SELECT TO_CHAR(DATE_TRUNC('month', "createdAt"), 'Mon YYYY') AS month,
             COUNT(*)::text AS count
      FROM "Business"
      WHERE "createdAt" >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY DATE_TRUNC('month', "createdAt")
    `,
  ])

  return NextResponse.json(serialize({
    totalBusinesses,
    activeBusinesses,
    suspendedBusinesses,
    totalUsers,
    activeSupportSessions,
    recentBusinesses,
    monthlySignups,
  }))
}
