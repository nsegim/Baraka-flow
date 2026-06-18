import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

interface CsvRow {
  name:        string
  sku?:        string
  price:       string
  costPrice?:  string
  stock?:      string
  minStock?:   string
  unit?:       string
  description?: string
  category?:   string
  origin?:     string
}

function parseNumber(val: string | undefined): number | null {
  if (!val || val.trim() === "") return null
  const n = parseFloat(val.replace(/,/g, ""))
  return isNaN(n) ? null : n
}

function parseCSV(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []

  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/\s+/g, ""))
  const rows: CsvRow[] = []

  for (let i = 1; i < lines.length; i++) {
    // Handle quoted fields with commas inside
    const values: string[] = []
    let current = ""
    let inQuote = false
    for (const ch of lines[i]) {
      if (ch === '"') { inQuote = !inQuote }
      else if (ch === "," && !inQuote) { values.push(current.trim()); current = "" }
      else { current += ch }
    }
    values.push(current.trim())

    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = values[idx] ?? "" })

    const name = row["name"] || row["productname"] || row["product_name"] || row["product"]
    if (!name || !name.trim()) continue

    rows.push({
      name:        name.trim(),
      sku:         row["sku"] || row["code"] || row["barcode"],
      price:       row["price"] || row["sellingprice"] || row["selling_price"] || "0",
      costPrice:   row["costprice"] || row["cost_price"] || row["cost"] || row["buyingprice"],
      stock:       row["stock"] || row["quantity"] || row["qty"] || row["stockquantity"],
      minStock:    row["minstock"] || row["min_stock"] || row["minimumstock"] || row["reorderlevel"],
      unit:        row["unit"] || row["uom"],
      description: row["description"] || row["desc"],
      category:    row["category"] || row["categoryname"] || row["category_name"],
      origin:      row["origin"] || row["country"] || row["supplier"],
    })
  }
  return rows
}

// POST /api/products/import — OWNER and MANAGER only
// Body: FormData with a "file" field (CSV)
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!["OWNER", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

    if (!file.name.toLowerCase().endsWith(".csv")) {
      return NextResponse.json({ error: "Only CSV files are supported" }, { status: 400 })
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 400 })
    }

    const text = await file.text()
    const rows = parseCSV(text)

    if (rows.length === 0) {
      return NextResponse.json({ error: "No valid rows found. Make sure the file has a header row with at least a 'name' column." }, { status: 400 })
    }

    const businessId = session.user.businessId

    // Pre-load existing categories to avoid duplicates
    const existingCategories = await prisma.category.findMany({
      where: { businessId },
      select: { id: true, name: true },
    })
    const categoryMap = new Map(existingCategories.map(c => [c.name.toLowerCase(), c.id]))

    const imported: string[] = []
    const skipped:  string[] = []

    for (const row of rows) {
      try {
        const price = parseNumber(row.price)
        if (price === null || price < 0) { skipped.push(`${row.name} (invalid price)`); continue }

        // Resolve or create category
        let categoryId: string | undefined
        if (row.category?.trim()) {
          const key = row.category.trim().toLowerCase()
          if (categoryMap.has(key)) {
            categoryId = categoryMap.get(key)!
          } else {
            const newCat = await prisma.category.create({
              data: { name: row.category.trim(), businessId },
            })
            categoryMap.set(key, newCat.id)
            categoryId = newCat.id
          }
        }

        await prisma.product.create({
          data: {
            name:        row.name,
            sku:         row.sku?.trim() || null,
            price,
            costPrice:   parseNumber(row.costPrice),
            stock:       Math.max(0, Math.floor(parseNumber(row.stock) ?? 0)),
            minStock:    Math.max(0, Math.floor(parseNumber(row.minStock) ?? 5)),
            unit:        row.unit?.trim() || "piece",
            description: row.description?.trim() || null,
            origin:      row.origin?.trim() || null,
            categoryId:  categoryId ?? null,
            businessId,
          },
        })
        imported.push(row.name)
      } catch {
        skipped.push(`${row.name} (error)`)
      }
    }

    return NextResponse.json({
      imported: imported.length,
      skipped:  skipped.length,
      skippedItems: skipped,
    })

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to process import" }, { status: 500 })
  }
}
