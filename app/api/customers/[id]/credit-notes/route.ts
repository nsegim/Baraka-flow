import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { randomUUID } from "crypto"

const CreateCreditNoteSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  reason: z.string().min(1, "Reason is required").max(500),
  notes:  z.string().max(1000).optional().nullable(),
})

type CreditNoteRow = {
  id:               string
  creditNoteNumber: string
  amount:           string
  reason:           string
  notes:            string | null
  status:           string
  createdAt:        string
  createdByName:    string | null
}

// GET /api/customers/[id]/credit-notes — last 50 credit notes for this customer
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id: customerId } = await params
    const businessId = session.user.businessId

    const rows = await prisma.$queryRaw<CreditNoteRow[]>`
      SELECT
        cn.id,
        cn."creditNoteNumber",
        cn.amount::text,
        cn.reason,
        cn.notes,
        cn.status,
        cn."createdAt"::text,
        u.name AS "createdByName"
      FROM "CreditNote" cn
      LEFT JOIN "User" u ON u.id = cn."createdById"
      WHERE cn."customerId" = ${customerId}
        AND cn."businessId" = ${businessId}
      ORDER BY cn."createdAt" DESC
      LIMIT 50
    `.catch(() => [] as CreditNoteRow[])

    return NextResponse.json(rows.map(r => ({ ...r, amount: Number(r.amount) })))

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to fetch credit notes" }, { status: 500 })
  }
}

// POST /api/customers/[id]/credit-notes — OWNER and MANAGER only
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!["OWNER", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Only Managers and Owners can issue credit notes" },
        { status: 403 }
      )
    }

    const { id: customerId } = await params
    const businessId = session.user.businessId

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, businessId },
    })
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 })

    const body   = await request.json()
    const parsed = CreateCreditNoteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }
    const { amount, reason, notes } = parsed.data

    // Generate collision-safe CN number
    const year = new Date().getFullYear()
    const countRaw = await prisma.$queryRaw<{ count: string }[]>`
      SELECT COUNT(*)::text AS count FROM "CreditNote" WHERE "businessId" = ${businessId}
    `.catch(() => [{ count: "0" }])
    const creditNoteNumber = `CN-${year}-${String(Number(countRaw[0]?.count ?? 0) + 1).padStart(4, "0")}`

    const id  = randomUUID()
    const now = new Date()

    // Create the credit note and reduce the customer's outstanding balance atomically
    await prisma.$transaction([
      prisma.$executeRaw`
        INSERT INTO "CreditNote"
          (id, "creditNoteNumber", amount, reason, notes, status,
           "customerId", "businessId", "createdById", "createdAt", "updatedAt")
        VALUES
          (${id}, ${creditNoteNumber}, ${amount}::numeric, ${reason}, ${notes ?? null}, 'ISSUED',
           ${customerId}, ${businessId}, ${session.user.id}, ${now}, ${now})
      `,
      prisma.$executeRaw`
        UPDATE "Customer"
        SET "outstandingBalance" = "outstandingBalance" - ${amount}::numeric,
            "updatedAt" = NOW()
        WHERE id = ${customerId}
          AND "businessId" = ${businessId}
      `,
    ])

    return NextResponse.json({
      id,
      creditNoteNumber,
      amount,
      reason,
      notes:         notes ?? null,
      status:        "ISSUED",
      createdAt:     now.toISOString(),
      createdByName: session.user.name,
    }, { status: 201 })

  } catch (error: unknown) {
    console.error(error)
    const msg = error instanceof Error ? error.message : ""
    if (msg.includes('relation "CreditNote" does not exist')) {
      return NextResponse.json(
        { error: "Run migration first: npx prisma migrate dev --name add_credit_notes" },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: "Failed to create credit note" }, { status: 500 })
  }
}
