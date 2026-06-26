import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UpdateStockTransferSchema } from "@/lib/validators"
import { serialize } from "@/lib/serialize"
import { createAuditLog } from "@/lib/audit"
import { createNotification } from "@/lib/notify"
import { getIp } from "@/lib/rate-limit"

// GET /api/stock-transfers/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params

    const transfer = await prisma.stockTransfer.findFirst({
      where: { id, businessId: session.user.businessId },
      include: {
        fromBranch:  { select: { id: true, name: true, code: true } },
        toBranch:    { select: { id: true, name: true, code: true } },
        product:     { select: { id: true, name: true, unit: true } },
        requestedBy: { select: { id: true, name: true } },
        approvedBy:  { select: { id: true, name: true } },
      },
    })
    if (!transfer) return NextResponse.json({ error: "Transfer not found" }, { status: 404 })

    // MANAGER/STAFF can only see transfers involving their branch
    if (session.user.role !== "OWNER" && session.user.branchId) {
      const involved = transfer.fromBranchId === session.user.branchId
                    || transfer.toBranchId   === session.user.branchId
      if (!involved) return NextResponse.json({ error: "Transfer not found" }, { status: 404 })
    }

    return NextResponse.json(serialize(transfer))
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to fetch transfer" }, { status: 500 })
  }
}

// PATCH /api/stock-transfers/[id] — approve, complete, or reject
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!["OWNER", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const { id } = await params
    const body   = await request.json()
    const parsed = UpdateStockTransferSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const transfer = await prisma.stockTransfer.findFirst({
      where: { id, businessId: session.user.businessId },
      include: {
        fromBranch: { select: { name: true } },
        toBranch:   { select: { name: true } },
        product:    { select: { name: true } },
      },
    })
    if (!transfer) return NextResponse.json({ error: "Transfer not found" }, { status: 404 })

    if (transfer.status !== "PENDING" && parsed.data.status !== "COMPLETED") {
      return NextResponse.json(
        { error: `Cannot change a transfer that is already ${transfer.status.toLowerCase()}` },
        { status: 400 }
      )
    }

    // MANAGER can only approve/reject transfers TO their branch; OWNER can do anything
    if (session.user.role === "MANAGER") {
      if (parsed.data.status === "APPROVED" || parsed.data.status === "REJECTED") {
        if (transfer.toBranchId !== session.user.branchId) {
          return NextResponse.json(
            { error: "You can only approve/reject transfers destined for your branch" },
            { status: 403 }
          )
        }
      }
    }

    let updated = transfer

    if (parsed.data.status === "COMPLETED") {
      // Validate stock still available before completing
      const sourceInv = await prisma.branchInventory.findUnique({
        where: { branchId_productId: { branchId: transfer.fromBranchId, productId: transfer.productId } },
      })
      if ((sourceInv?.stock ?? 0) < transfer.quantity) {
        return NextResponse.json(
          { error: `Insufficient stock in ${transfer.fromBranch.name} to complete transfer` },
          { status: 400 }
        )
      }

      await prisma.$transaction(async (tx) => {
        // Deduct from source branch
        await tx.branchInventory.upsert({
          where:  { branchId_productId: { branchId: transfer.fromBranchId, productId: transfer.productId } },
          update: { stock: { decrement: transfer.quantity } },
          create: { branchId: transfer.fromBranchId, productId: transfer.productId, stock: 0 },
        })
        // Add to destination branch
        await tx.branchInventory.upsert({
          where:  { branchId_productId: { branchId: transfer.toBranchId, productId: transfer.productId } },
          update: { stock: { increment: transfer.quantity } },
          create: { branchId: transfer.toBranchId, productId: transfer.productId, stock: transfer.quantity },
        })
        // Log movement on both branches
        await tx.stockMovement.create({
          data: {
            type:      "TRANSFER_OUT",
            quantity:  -transfer.quantity,
            reason:    `Transfer to ${transfer.toBranch.name}`,
            productId: transfer.productId,
            branchId:  transfer.fromBranchId,
            userId:    session.user.id,
          },
        })
        await tx.stockMovement.create({
          data: {
            type:      "TRANSFER_IN",
            quantity:  transfer.quantity,
            reason:    `Transfer from ${transfer.fromBranch.name}`,
            productId: transfer.productId,
            branchId:  transfer.toBranchId,
            userId:    session.user.id,
          },
        })
        // Update transfer status
        await tx.stockTransfer.update({
          where: { id },
          data: {
            status:      "COMPLETED",
            approvedById: session.user.id,
            completedAt:  new Date(),
            notes:        parsed.data.notes ?? transfer.notes,
          },
        })
      })

      createNotification(
        session.user.businessId,
        "STOCK_TRANSFER",
        "Stock Transfer Completed",
        `${transfer.quantity}x ${transfer.product.name}: ${transfer.fromBranch.name} → ${transfer.toBranch.name}`,
        "/stock-transfers",
      )

      createAuditLog({
        businessId: session.user.businessId,
        branchId:   transfer.fromBranchId,
        userId:     session.user.id,
        action:     "STOCK_TRANSFER_COMPLETED",
        entityType: "StockTransfer",
        entityId:   id,
        metadata:   {
          productName: transfer.product.name,
          quantity:    transfer.quantity,
          fromBranch:  transfer.fromBranch.name,
          toBranch:    transfer.toBranch.name,
        },
        ipAddress: getIp(request),
      })
    } else {
      // APPROVED or REJECTED
      await prisma.stockTransfer.update({
        where: { id },
        data: {
          status:      parsed.data.status,
          approvedById: session.user.id,
          notes:        parsed.data.notes ?? transfer.notes,
        },
      })

      const auditAction = parsed.data.status === "APPROVED"
        ? "STOCK_TRANSFER_APPROVED"
        : "STOCK_TRANSFER_REJECTED"

      createAuditLog({
        businessId: session.user.businessId,
        branchId:   transfer.fromBranchId,
        userId:     session.user.id,
        action:     auditAction,
        entityType: "StockTransfer",
        entityId:   id,
        metadata:   { productName: transfer.product.name, status: parsed.data.status },
        ipAddress:  getIp(request),
      })
    }

    const result = await prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        fromBranch:  { select: { id: true, name: true, code: true } },
        toBranch:    { select: { id: true, name: true, code: true } },
        product:     { select: { id: true, name: true, unit: true } },
        requestedBy: { select: { id: true, name: true } },
        approvedBy:  { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(serialize(result))
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to update stock transfer" }, { status: 500 })
  }
}
