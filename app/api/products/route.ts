import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CreateProductSchema } from "@/lib/validators"
import { serialize } from "@/lib/serialize"

// GET /api/products
// Supports ?all=true (no pagination — for dropdowns like OrderModal)
// Supports ?page=N&limit=N (paginated — for the inventory table)
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const fetchAll = searchParams.get("all") === "true"
    const page     = Math.max(1, parseInt(searchParams.get("page")  ?? "1"))
    const limit    = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50")))
    const skip     = (page - 1) * limit

    const where = { businessId: session.user.businessId }

    if (fetchAll) {
      // Used by dropdowns — return up to 1000, no pagination wrapper
      const products = await prisma.product.findMany({
        where,
        include:  { category: true, supplier: true },
        orderBy:  { name: "asc" },
        take:     1000,
      })
      return NextResponse.json(serialize(products))
    }

    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        include: { category: true, supplier: true },
        orderBy: { createdAt: "desc" },
        skip,
        take:    limit,
      }),
      prisma.product.count({ where }),
    ])

    return NextResponse.json({
      data: serialize(products),
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    })

  } catch (error) {
    console.error("GET /api/products error:", error)
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 })
  }
}

// POST /api/products — OWNER and MANAGER only
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["OWNER", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "You do not have permission to add products" },
        { status: 403 }
      )
    }

    const body   = await request.json()
    const parsed = CreateProductSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const {
      name, description, sku, price, costPrice,
      stock, minStock, unit, origin, categoryId, supplierId,
    } = parsed.data

    const product = await prisma.product.create({
      data: {
        name,
        description:  description  ?? null,
        sku:          sku          ?? null,
        price,
        costPrice:    costPrice    ?? null,
        stock,
        minStock,
        unit,
        origin:       origin       ?? null,
        categoryId:   categoryId   ?? null,
        supplierId:   supplierId   ?? null,
        businessId:   session.user.businessId,
      },
      include: { category: true, supplier: true },
    })

    if (product.stock > 0) {
      await prisma.stockMovement.create({
        data: {
          type:      "IMPORT",
          quantity:  product.stock,
          reason:    "Initial stock on product creation",
          productId: product.id,
          userId: session.user.id 
        },
      })
    }

    return NextResponse.json(serialize(product), { status: 201 })

  } catch (error) {
    console.error("POST /api/products error:", error)
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 })
  }
}
