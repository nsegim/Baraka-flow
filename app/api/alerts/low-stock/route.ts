import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { can, type Role } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { sendLowStockAlert } from "@/lib/email"

// POST /api/alerts/low-stock — OWNER and MANAGER only
// Sends a low-stock alert email to the business owner listing all products at or below minStock.
export async function POST(_request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(session.user.role as Role, "stock:adjust")) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const businessId = session.user.businessId

    type LowStockRow = { name: string; sku: string; stock: number; minStock: number }

    const [business, products] = await Promise.all([
      prisma.business.findUnique({
        where:  { id: businessId },
        select: { name: true, email: true },
      }),
      prisma.$queryRaw<LowStockRow[]>`
        SELECT p.name, p.sku, bi.stock::int AS stock, bi."minStock"::int AS "minStock"
        FROM "BranchInventory" bi
        JOIN "Product" p ON p.id = bi."productId"
        JOIN "Branch"  b ON b.id = bi."branchId"
        WHERE p."businessId" = ${businessId}
          AND b."isActive"   = true
          AND bi.stock       <= bi."minStock"
        ORDER BY bi.stock ASC
        LIMIT 50
      `.catch(() => [] as LowStockRow[]),
    ])

    if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 })

    if (products.length === 0) {
      return NextResponse.json({ message: "No low-stock products found", sent: false })
    }

    await sendLowStockAlert({
      to:           business.email,
      businessName: business.name,
      products,
    })

    return NextResponse.json({ message: `Alert sent for ${products.length} products`, sent: true, count: products.length })

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to send alert" }, { status: 500 })
  }
}
