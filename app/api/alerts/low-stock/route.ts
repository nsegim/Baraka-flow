import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendLowStockAlert } from "@/lib/email"

// POST /api/alerts/low-stock — OWNER and MANAGER only
// Sends a low-stock alert email to the business owner listing all products at or below minStock.
export async function POST(_request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!["OWNER", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const businessId = session.user.businessId

    const [business, products] = await Promise.all([
      prisma.business.findUnique({
        where:  { id: businessId },
        select: { name: true, email: true },
      }),
      prisma.product.findMany({
        where: { businessId, stock: { lte: prisma.product.fields.minStock } },
        select: { name: true, sku: true, stock: true, minStock: true },
        orderBy: { stock: "asc" },
      }).catch(() =>
        // Fallback: manual comparison if lte on field reference isn't supported
        prisma.product.findMany({ where: { businessId }, select: { name: true, sku: true, stock: true, minStock: true } })
          .then(all => all.filter(p => p.stock <= p.minStock))
      ),
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
