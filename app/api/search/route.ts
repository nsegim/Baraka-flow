import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Get search query from URL
    // e.g. /api/search?q=sofa → q = "sofa"
    const query      = request.nextUrl.searchParams.get("q")
    const businessId = session.user.businessId

    // If query is empty or too short — return nothing
    if (!query || query.trim().length < 2) {
      return NextResponse.json({ products: [], orders: [] })
    }

    const q = query.trim()

    // Search products, orders, customers and suppliers in parallel
    const [products, orders, customers, suppliers] = await Promise.all([

      prisma.product.findMany({
        where: {
          businessId,
          OR: [
            { name:   { contains: q, mode: "insensitive" } },
            { sku:    { contains: q, mode: "insensitive" } },
            { origin: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, stock: true, price: true, sku: true },
        take: 4,
      }),

      prisma.order.findMany({
        where: {
          businessId,
          OR: [
            { orderNumber:   { contains: q, mode: "insensitive" } },
            { customerName:  { contains: q, mode: "insensitive" } },
            { customerPhone: { contains: q, mode: "insensitive" } },
          ],
        },
        select: {
          id: true, orderNumber: true,
          customerName: true, totalAmount: true, status: true,
        },
        take: 4,
      }),

      prisma.customer.findMany({
        where: {
          businessId,
          OR: [
            { name:  { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, phone: true, email: true },
        take: 3,
      }),

      prisma.supplier.findMany({
        where: {
          businessId,
          name: { contains: q, mode: "insensitive" },
        },
        select: { id: true, name: true, country: true },
        take: 3,
      }),

    ])

    return NextResponse.json({ products, orders, customers, suppliers })

  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    )
  }
}