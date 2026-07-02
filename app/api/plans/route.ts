import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { serialize } from "@/lib/serialize"

// GET /api/plans — public active plans (for billing page, any authenticated user)
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const plans = await prisma.plan.findMany({
    where:   { isActive: true, isPublic: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true, name: true, slug: true, description: true,
      price: true, currency: true,
      maxUsers: true, maxProducts: true, maxOrders: true, maxBranches: true,
      features: true, isActive: true, isPublic: true, sortOrder: true,
    },
  })

  return NextResponse.json(serialize(plans))
}
