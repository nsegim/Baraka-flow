import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { serialize } from "@/lib/serialize"
import { z } from "zod"
import { createAuditLog } from "@/lib/audit"
import { getIp } from "@/lib/rate-limit"

const CreateSupplierPaymentSchema = z.object({
  supplierId:      z.string().min(1, "Supplier is required"),
  purchaseOrderId: z.string().optional().nullable(),
  amount:          z.number().positive("Amount must be positive"),
  method:          z.enum(["CASH", "MOBILE_MONEY", "BANK_TRANSFER", "CREDIT"]),
  reference:       z.string().max(200).optional().nullable(),
  notes:           z.string().max(500).optional().nullable(),
  paidAt:          z.string().optional(),
})

// GET /api/supplier-payments?supplierId=xxx — list payments for a supplier
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supplierId = request.nextUrl.searchParams.get("supplierId")
    const page       = Math.max(1, parseInt(request.nextUrl.searchParams.get("page") ?? "1"))
    const limit      = 20
    const skip       = (page - 1) * limit

    const where = supplierId
      ? { businessId: session.user.businessId, supplierId }
      : { businessId: session.user.businessId }

    const [payments, total] = await prisma.$transaction([
      prisma.supplierPayment.findMany({
        where,
        orderBy: { paidAt: "desc" },
        skip,
        take:    limit,
        include: {
          supplier:     { select: { id: true, name: true } },
          purchaseOrder:{ select: { id: true, poNumber: true } },
          createdBy:    { select: { name: true } },
        },
      }),
      prisma.supplierPayment.count({ where }),
    ])

    return NextResponse.json(serialize({
      data: payments,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    }))
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to fetch supplier payments" }, { status: 500 })
  }
}

// POST /api/supplier-payments — record a payment to a supplier
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!["OWNER", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const body   = await request.json()
    const parsed = CreateSupplierPaymentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { supplierId, purchaseOrderId, amount, method, reference, notes, paidAt } = parsed.data

    // Verify supplier belongs to this business
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, businessId: session.user.businessId },
    })
    if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 })

    // Verify PO belongs to this business (if provided)
    if (purchaseOrderId) {
      const po = await prisma.purchaseOrder.findFirst({
        where: { id: purchaseOrderId, businessId: session.user.businessId, supplierId },
      })
      if (!po) return NextResponse.json({ error: "Purchase order not found" }, { status: 404 })
    }

    const payment = await prisma.$transaction(async (tx) => {
      const newPayment = await tx.supplierPayment.create({
        data: {
          supplierId,
          purchaseOrderId: purchaseOrderId ?? null,
          amount,
          method,
          reference:  reference ?? null,
          notes:      notes     ?? null,
          paidAt:     paidAt ? new Date(paidAt) : new Date(),
          businessId: session.user.businessId,
          createdById: session.user.id,
        },
        include: {
          supplier:      { select: { id: true, name: true } },
          purchaseOrder: { select: { id: true, poNumber: true } },
          createdBy:     { select: { name: true } },
        },
      })

      // AP: reduce supplier outstanding balance
      await tx.supplier.update({
        where: { id: supplierId },
        data:  { outstandingBalance: { decrement: amount } },
      })

      // AP: if linked to a PO, update PO amountPaid and paymentStatus
      if (purchaseOrderId) {
        const po = await tx.purchaseOrder.findUnique({
          where:  { id: purchaseOrderId },
          select: { totalCost: true, amountPaid: true },
        })
        if (po) {
          const newAmountPaid   = Number(po.amountPaid) + amount
          const total           = Number(po.totalCost)
          const paymentStatus   = newAmountPaid >= total ? "PAID"
                                : newAmountPaid > 0      ? "PARTIAL"
                                : "UNPAID"
          await tx.purchaseOrder.update({
            where: { id: purchaseOrderId },
            data:  { amountPaid: newAmountPaid, paymentStatus },
          })
        }
      }

      return newPayment
    })

    createAuditLog({
      businessId: session.user.businessId,
      userId:     session.user.id,
      action:     "SUPPLIER_PAYMENT_RECORDED",
      entityType: "SupplierPayment",
      entityId:   payment.id,
      metadata:   { supplierName: supplier.name, amount, method, purchaseOrderId: purchaseOrderId ?? null },
      ipAddress:  getIp(request),
    })

    return NextResponse.json(serialize(payment), { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to record supplier payment" }, { status: 500 })
  }
}
