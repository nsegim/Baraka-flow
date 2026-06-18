import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { serialize } from "@/lib/serialize"
import { z } from "zod"
import { randomUUID } from "crypto"

const ReturnSchema = z.object({
  reason:         z.string().min(1, "Reason is required").max(500),
  issueCreditNote: z.boolean().default(true),
})

// POST /api/orders/[id]/return
// Restocks all items, marks order as CANCELLED (returned), optionally issues a credit note.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!["OWNER", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const { id } = await params
    const body   = await request.json()

    const parsed = ReturnSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }
    const { reason, issueCreditNote } = parsed.data

    const order = await prisma.order.findFirst({
      where:   { id, businessId: session.user.businessId },
      include: { items: { include: { product: true } } },
    })

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

    if (order.status !== "DELIVERED") {
      return NextResponse.json(
        { error: "Only delivered orders can be returned" },
        { status: 400 }
      )
    }

    const businessId = session.user.businessId

    // Restock all items and mark order cancelled in one transaction
    await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data:  { stock: { increment: item.quantity } },
        })
        await tx.stockMovement.create({
          data: {
            type:      "RETURN",
            quantity:  item.quantity,
            reason:    `Return: ${order.orderNumber} — ${reason}`,
            productId: item.productId,
            userId:    session.user.id,
          },
        })
      }
      await tx.order.update({
        where: { id },
        data:  { status: "CANCELLED", notes: `RETURNED: ${reason}${order.notes ? `\n${order.notes}` : ""}` },
      })
    })

    // Optionally issue a credit note for the order total
    let creditNote = null
    if (issueCreditNote && order.customerId) {
      try {
        const year     = new Date().getFullYear()
        const countRaw = await prisma.$queryRaw<{ count: string }[]>`
          SELECT COUNT(*)::text AS count FROM "CreditNote" WHERE "businessId" = ${businessId}
        `.catch(() => [{ count: "0" }])
        const creditNoteNumber = `CN-${year}-${String(Number(countRaw[0]?.count ?? 0) + 1).padStart(4, "0")}`
        const cnId  = randomUUID()
        const now   = new Date()
        const total = Number(order.totalAmount)

        await prisma.$transaction([
          prisma.$executeRaw`
            INSERT INTO "CreditNote"
              (id, "creditNoteNumber", amount, reason, notes, status,
               "customerId", "businessId", "createdById", "createdAt", "updatedAt")
            VALUES
              (${cnId}, ${creditNoteNumber}, ${total}::numeric,
               ${`Return of ${order.orderNumber}: ${reason}`}, null, 'ISSUED',
               ${order.customerId}, ${businessId}, ${session.user.id}, ${now}, ${now})
          `,
          prisma.$executeRaw`
            UPDATE "Customer"
            SET "outstandingBalance" = "outstandingBalance" - ${total}::numeric,
                "updatedAt" = NOW()
            WHERE id = ${order.customerId}
              AND "businessId" = ${businessId}
          `,
        ])

        creditNote = { id: cnId, creditNoteNumber, amount: total }
      } catch {
        // Credit note table may not exist yet — return succeeds regardless
      }
    }

    const updated = await prisma.order.findFirst({
      where:   { id },
      include: {
        items:    { include: { product: true } },
        user:     { select: { name: true } },
        payments: { orderBy: { paidAt: "desc" } },
      },
    })

    return NextResponse.json({ order: serialize(updated), creditNote })

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to process return" }, { status: 500 })
  }
}
