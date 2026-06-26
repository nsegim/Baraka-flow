import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { serialize } from "@/lib/serialize"

// GET /api/settings/access-history
// OWNER only — returns any support sessions that have accessed this business.
// Platform user email is intentionally withheld; name is shown for transparency.
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // Auto-expire sessions whose expiresAt has passed before returning the list
  await prisma.supportSession.updateMany({
    where: { businessId: session.user.businessId, status: "ACTIVE", expiresAt: { lt: new Date() } },
    data:  { status: "EXPIRED" },
  })

  const sessions = await prisma.supportSession.findMany({
    where:   { businessId: session.user.businessId },
    orderBy: { createdAt: "desc" },
    take:    50,
    select: {
      id: true, status: true, accessScope: true,
      justification: true, expiresAt: true, endedAt: true, createdAt: true,
      platformUser: { select: { name: true } },
      _count:       { select: { actions: true } },
    },
  })

  return NextResponse.json(serialize(sessions))
}
