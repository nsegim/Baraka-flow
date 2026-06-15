import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// ─────────────────────────────────────────
// GET /api/products
// Returns all products for the logged-in user's business
// ─────────────────────────────────────────
export async function GET() {
  try {
    // 1. Get current session — who is making this request?
    const session = await auth()

    // 2. If not logged in — reject immediately
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // 3. Fetch only THIS business's products
    // This is critical — a business must never see another
    // business's products
    const products = await prisma.product.findMany({
      where: {
        businessId: session.user.businessId
      },
      include: {
        category: true,   // include category name
        supplier: true,   // include supplier name
      },
      orderBy: {
        createdAt: "desc" // newest first
      }
    })

    return NextResponse.json(products)

  } catch (error) {
    console.error("GET /api/products error:", error)
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    )
  }
}

// ─────────────────────────────────────────
// POST /api/products
// Creates a new product for this business
// ─────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    // 1. Verify session
    const session = await auth()
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // 2. Read the product data from request
    const body = await request.json()
    const {
      name,
      description,
      sku,
      price,
      costPrice,
      stock,
      minStock,
      unit,
      origin,
      categoryId,
      supplierId,
    } = body

    // 3. Validate required fields
    if (!name || price === undefined || price === null) {
      return NextResponse.json(
        { error: "Name and price are required" },
        { status: 400 }
      )
    }

    // 4. Create the product
    const product = await prisma.product.create({
      data: {
        name,
        description:  description  || null,
        sku:          sku          || null,
        price:        parseFloat(price),
        costPrice:    costPrice    ? parseFloat(costPrice) : null,
        stock:        parseInt(stock)    || 0,
        minStock:     parseInt(minStock) || 5,
        unit:         unit         || "piece",
        origin:       origin       || null,
        categoryId:   categoryId   || null,
        supplierId:   supplierId   || null,
        businessId:   session.user.businessId,
      },
      include: {
        category: true,
        supplier: true,
      }
    })

    // 5. Also record this as a stock movement
    // So we have a permanent log of when stock was first added
    if (product.stock > 0) {
      await prisma.stockMovement.create({
        data: {
          type:      "IMPORT",
          quantity:  product.stock,
          reason:    "Initial stock on product creation",
          productId: product.id,
        }
      })
    }

    return NextResponse.json(product, { status: 201 })

  } catch (error) {
    console.error("POST /api/products error:", error)
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500 }
    )
  }
}