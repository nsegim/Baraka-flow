/**
 * One-time migration: drop the legacy stock/minStock columns from Product.
 * Run AFTER: npx prisma migrate dev --name add_multi_branch
 * Run AFTER: npx tsx prisma/seed-branches.ts
 *
 * Usage: npx tsx prisma/drop-legacy-stock-columns.ts
 */

import "dotenv/config"
import { PrismaClient } from "../lib/generated/prisma/client"

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL } },
})

async function main() {
  console.log("Checking for legacy columns…")

  // Check if the columns still exist before trying to drop them
  const result = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name  = 'Product'
      AND column_name IN ('stock', 'minStock')
  `

  if (result.length === 0) {
    console.log("Columns already removed — nothing to do.")
    return
  }

  console.log(`Found legacy columns: ${result.map((r: { column_name: string }) => r.column_name).join(", ")}`)
  console.log("Dropping…")

  await prisma.$executeRaw`
    ALTER TABLE "Product"
    DROP COLUMN IF EXISTS stock,
    DROP COLUMN IF EXISTS "minStock"
  `

  console.log("Done. Legacy stock/minStock columns removed from Product table.")
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
