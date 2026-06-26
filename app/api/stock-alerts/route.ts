import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireBranchContext, isBranchContext } from "@/lib/branch-auth"

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireBranchContext(request)
    if (!isBranchContext(ctx)) return ctx

    const businessId = ctx.session.user.businessId
    const branchId   = ctx.branchId

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
      branchId:        string
      branchName:      string
      branchCode:      string
    }

    let rows: AlertRow[] = []

    if (branchId) {
      rows = await prisma.$queryRaw<AlertRow[]>`
        SELECT
          p.id,
          p.name,
          bi.stock::int           AS stock,
          bi."minStock"::int      AS "minStock",
          p.unit,
          p.sku,
          p."supplierId",
          s.name                  AS "supplierName",
          s.country               AS "supplierCountry",
          c.name                  AS "categoryName",
          b.id                    AS "branchId",
          b.name                  AS "branchName",
          b.code                  AS "branchCode"
        FROM "BranchInventory" bi
        JOIN "Product"  p ON p.id  = bi."productId"
        JOIN "Branch"   b ON b.id  = bi."branchId"
        LEFT JOIN "Category"  c ON c.id = p."categoryId"
        LEFT JOIN "Supplier"  s ON s.id = p."supplierId"
        WHERE p."businessId" = ${businessId}
          AND bi."branchId"  = ${branchId}
          AND bi.stock       <= bi."minStock"
        ORDER BY
          CASE WHEN bi.stock = 0 THEN 0 ELSE 1 END ASC,
          (bi.stock::float / NULLIF(bi."minStock"::float, 0)) ASC NULLS LAST,
          p.name ASC
      `
    } else {
      // Owner all-branches view: show alerts per branch
      rows = await prisma.$queryRaw<AlertRow[]>`
        SELECT
          p.id,
          p.name,
          bi.stock::int           AS stock,
          bi."minStock"::int      AS "minStock",
          p.unit,
          p.sku,
          p."supplierId",
          s.name                  AS "supplierName",
          s.country               AS "supplierCountry",
          c.name                  AS "categoryName",
          b.id                    AS "branchId",
          b.name                  AS "branchName",
          b.code                  AS "branchCode"
        FROM "BranchInventory" bi
        JOIN "Product"  p ON p.id  = bi."productId"
        JOIN "Branch"   b ON b.id  = bi."branchId"
        LEFT JOIN "Category"  c ON c.id = p."categoryId"
        LEFT JOIN "Supplier"  s ON s.id = p."supplierId"
        WHERE p."businessId" = ${businessId}
          AND b."isActive"   = true
          AND bi.stock       <= bi."minStock"
        ORDER BY
          CASE WHEN bi.stock = 0 THEN 0 ELSE 1 END ASC,
          (bi.stock::float / NULLIF(bi."minStock"::float, 0)) ASC NULLS LAST,
          b.name ASC, p.name ASC
      `
    }

    const outOfStock = rows.filter(r => r.stock === 0).length
    const lowStock   = rows.filter(r => r.stock > 0).length

    return NextResponse.json({ items: rows, outOfStock, lowStock })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to fetch stock alerts" }, { status: 500 })
  }
}
