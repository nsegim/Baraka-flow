import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UpdateBusinessSchema } from "@/lib/validators"
import { serialize } from "@/lib/serialize"

// GET /api/business — fetch this session's business profile
export async function GET(_request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const business = await prisma.business.findUnique({
      where: { id: session.user.businessId },
    })
    if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 })

    return NextResponse.json(serialize(business))

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to fetch business" }, { status: 500 })
  }
}

// PATCH /api/business — OWNER only
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Only the account owner can edit business settings" }, { status: 403 })
    }

    const body   = await request.json()
    const parsed = UpdateBusinessSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    // Strip taxRate — handled separately via raw SQL until migration runs
    const { taxRate, ...businessFields } = parsed.data

    const updated = await prisma.business.update({
      where: { id: session.user.businessId },
      data:  businessFields,
    })

    // Update taxRate with raw SQL (no-op if column not yet added by migration)
    if (taxRate !== undefined) {
      await prisma.$executeRaw`
        UPDATE "Business" SET "taxRate" = ${taxRate} WHERE id = ${session.user.businessId}
      `.catch(() => {})
    }

    return NextResponse.json(serialize(updated))

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to update business" }, { status: 500 })
  }
}
