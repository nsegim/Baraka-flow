import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const businessId = session.user.businessId

    // Products where stock <= minStock, sorted by urgency:
    // out-of-stock (stock=0) first, then by lowest stock-to-min ratio
    type AlertRow = {
      id:              string
      name:            string
      stock:           number
      minStock:        number
      unit:            string
      sku:             string | null
      supplierId:      string | null
      supplierName:    string | null
      supplierCountry: string | null
      categoryName:    string | null
    }

    const rows = await prisma.$queryRaw<AlertRow[]>`
      SELECT
        p.id,
        p.name,
        p.stock::int               AS stock,
        p."minStock"::int          AS "minStock",
        p.unit,
        p.sku,
        p."supplierId",
        s.name                     AS "supplierName",
        s.country                  AS "supplierCountry",
        c.name                     AS "categoryName"
      FROM "Product" p
      LEFT JOIN "Category" c ON c.id = p."categoryId"
      LEFT JOIN "Supplier" s ON s.id = p."supplierId"
      WHERE p."businessId" = ${businessId}
        AND p.stock <= p."minStock"
      ORDER BY
        CASE WHEN p.stock = 0 THEN 0 ELSE 1 END ASC,
        (p.stock::float / NULLIF(p."minStock"::float, 0)) ASC NULLS LAST,
        p.name ASC
    `

    const outOfStock = rows.filter(r => r.stock === 0).length
    const lowStock   = rows.filter(r => r.stock > 0).length

    return NextResponse.json({ items: rows, outOfStock, lowStock })

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to fetch stock alerts" }, { status: 500 })
  }
}
