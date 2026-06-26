import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

function escapeCSV(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return ""
  const str = String(val)
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function toCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [
    headers.map(escapeCSV).join(","),
    ...rows.map(row => row.map(escapeCSV).join(",")),
  ]
  return lines.join("\n")
}

// GET /api/export?type=products|orders|stock-movements
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const type       = request.nextUrl.searchParams.get("type") ?? "products"
    const businessId = session.user.businessId
    let csv = ""
    let filename = "export.csv"

    if (type === "products") {
      const products = await prisma.product.findMany({
        where:   { businessId },
        include: {
          category:  { select: { name: true } },
          supplier:  { select: { name: true } },
          inventory: { select: { stock: true, minStock: true } },
        },
        orderBy: { name: "asc" },
      })

      csv = toCSV(
        ["Name", "SKU", "Price (RWF)", "Cost Price (RWF)", "Stock (Total)", "Min Stock", "Unit", "Category", "Supplier", "Origin"],
        products.map(p => {
          const totalStock  = p.inventory.reduce((acc, bi) => acc + bi.stock, 0)
          const maxMinStock = p.inventory.reduce((acc, bi) => Math.max(acc, bi.minStock), 0)
          return [
            p.name, p.sku, Number(p.price), p.costPrice ? Number(p.costPrice) : null,
            totalStock, maxMinStock, p.unit, p.category?.name, p.supplier?.name, p.origin,
          ]
        })
      )
      filename = "products.csv"

    } else if (type === "orders") {
      const orders = await prisma.order.findMany({
        where:   { businessId },
        include: {
          items: { include: { product: { select: { name: true } } } },
          user:  { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      })

      const rows: (string | number | null | undefined)[][] = []
      for (const o of orders) {
        for (const item of o.items) {
          rows.push([
            o.orderNumber, o.customerName, o.customerPhone,
            o.status, o.paymentStatus,
            Number(o.totalAmount), Number(o.amountPaid),
            item.product.name, item.quantity, Number(item.unitPrice),
            o.createdAt.toISOString(), o.user.name,
          ])
        }
      }

      csv = toCSV(
        ["Order #", "Customer", "Phone", "Status", "Payment Status",
         "Total (RWF)", "Paid (RWF)", "Product", "Qty", "Unit Price (RWF)", "Date", "Created By"],
        rows
      )
      filename = "orders.csv"

    } else if (type === "stock-movements") {
      const movements = await prisma.stockMovement.findMany({
        where:   { product: { businessId } },
        include: {
          product: { select: { name: true } },
          user:    { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take:    5000,
      })

      csv = toCSV(
        ["Product", "Type", "Quantity", "Reason", "By", "Date"],
        movements.map(m => [
          m.product.name, m.type, m.quantity, m.reason,
          m.user?.name, m.createdAt.toISOString(),
        ])
      )
      filename = "stock-movements.csv"

    } else if (type === "customers") {
      const customers = await prisma.customer.findMany({
        where:   { businessId },
        include: { _count: { select: { orders: true } } },
        orderBy: { name: "asc" },
      })

      csv = toCSV(
        ["Name", "Phone", "Email", "Address", "Orders", "Outstanding Balance (RWF)", "Notes"],
        customers.map(c => [
          c.name, c.phone, c.email, c.address,
          c._count.orders, Number(c.outstandingBalance), c.notes,
        ])
      )
      filename = "customers.csv"

    } else if (type === "credit-notes") {
      type CNRow = { number: string; customer: string; amount: string; reason: string; notes: string | null; status: string; createdAt: string; createdBy: string | null }
      const rows = await prisma.$queryRaw<CNRow[]>`
        SELECT
          cn."creditNoteNumber"  AS number,
          cu.name                AS customer,
          cn.amount::text,
          cn.reason,
          cn.notes,
          cn.status,
          cn."createdAt"::text   AS "createdAt",
          u.name                 AS "createdBy"
        FROM "CreditNote" cn
        JOIN "Customer" cu ON cu.id = cn."customerId"
        LEFT JOIN "User" u ON u.id = cn."createdById"
        WHERE cn."businessId" = ${businessId}
        ORDER BY cn."createdAt" DESC
      `.catch(() => [] as CNRow[])

      csv = toCSV(
        ["Credit Note #", "Customer", "Amount (RWF)", "Reason", "Notes", "Status", "Date", "Issued By"],
        rows.map(r => [r.number, r.customer, Number(r.amount), r.reason, r.notes, r.status, r.createdAt, r.createdBy])
      )
      filename = "credit-notes.csv"

    } else if (type === "expenses") {
      const expenses = await prisma.expense.findMany({
        where:   { businessId },
        include: { createdBy: { select: { name: true } } },
        orderBy: { date: "desc" },
      })

      csv = toCSV(
        ["Title", "Category", "Amount (RWF)", "Date", "Notes", "Created By"],
        expenses.map(e => [
          e.title, e.category, Number(e.amount),
          e.date.toISOString().slice(0, 10), e.notes, e.createdBy.name,
        ])
      )
      filename = "expenses.csv"

    } else {
      return NextResponse.json({ error: "Invalid export type" }, { status: 400 })
    }

    return new NextResponse(csv, {
      status:  200,
      headers: {
        "Content-Type":        "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Export failed" }, { status: 500 })
  }
}
