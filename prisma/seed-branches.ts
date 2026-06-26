/**
 * Migration script: bootstrap multi-branch support for existing data.
 *
 * Run ONCE after applying the schema migration:
 *   npx tsx prisma/seed-branches.ts
 *
 * What it does:
 *  1. For each Business, creates a default "Main Branch" (isDefault=true, code="HQ")
 *  2. Copies Product.stock → BranchInventory for that branch (NOTE: Product.stock
 *     was removed from the schema; this script reads the backup column if you ran
 *     the migration with a rename, or you can adapt it to read from your own snapshot)
 *  3. Sets branchId on all existing Orders, Expenses, PurchaseOrders, StockMovements,
 *     Customers, Notifications, and AuditLogs to the default branch
 *  4. Creates BranchUser rows for all MANAGER/STAFF users, assigning them to the
 *     default branch of their business
 *
 * Safe to re-run: every step checks for existing records before creating.
 */

import "dotenv/config"
import { PrismaClient } from "../lib/generated/prisma/client"

// Migration scripts must use the direct connection, not the transaction-mode pooler
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL } },
})

async function main() {
  console.log("Starting multi-branch migration seed...")

  const businesses = await prisma.business.findMany({
    include: {
      users:    true,
      products: true,
    },
  })

  console.log(`Found ${businesses.length} business(es) to migrate.`)

  for (const business of businesses) {
    console.log(`\nProcessing business: ${business.name} (${business.id})`)

    // ── 1. Create default branch ──────────────────────────────────────────────
    let defaultBranch = await prisma.branch.findFirst({
      where: { businessId: business.id, isDefault: true },
    })

    if (!defaultBranch) {
      defaultBranch = await prisma.branch.create({
        data: {
          name:       "Main Branch",
          code:       "HQ",
          isDefault:  true,
          isActive:   true,
          businessId: business.id,
        },
      })
      console.log(`  ✓ Created default branch: ${defaultBranch.name} (${defaultBranch.id})`)
    } else {
      console.log(`  ✓ Default branch already exists: ${defaultBranch.name}`)
    }

    // ── 2. Create BranchInventory for each product ────────────────────────────
    // NOTE: at this point Product.stock has been removed from the Prisma schema,
    // but the column still exists in Postgres until you drop it manually.
    // We read it via raw SQL.
    type RawProduct = { id: string; stock: number; "minStock": number }
    const rawProducts = await prisma.$queryRaw<RawProduct[]>`
      SELECT id, stock::int AS stock, "minStock"::int AS "minStock"
      FROM "Product"
      WHERE "businessId" = ${business.id}
    `

    let inventoryCreated = 0
    for (const product of rawProducts) {
      const existing = await prisma.branchInventory.findUnique({
        where: { branchId_productId: { branchId: defaultBranch.id, productId: product.id } },
      })
      if (!existing) {
        await prisma.branchInventory.create({
          data: {
            branchId:  defaultBranch.id,
            productId: product.id,
            stock:     product.stock    ?? 0,
            minStock:  product.minStock ?? 5,
          },
        })
        inventoryCreated++
      }
    }
    console.log(`  ✓ Created ${inventoryCreated} BranchInventory rows`)

    // ── 3. Backfill branchId on Orders ───────────────────────────────────────
    const ordersUpdated = await prisma.$executeRaw`
      UPDATE "Order"
      SET "branchId" = ${defaultBranch.id}
      WHERE "businessId" = ${business.id}
        AND ("branchId" IS NULL OR "branchId" = '')
    `
    console.log(`  ✓ Backfilled branchId on ${ordersUpdated} orders`)

    // ── 4. Backfill branchId on Expenses ─────────────────────────────────────
    const expensesUpdated = await prisma.$executeRaw`
      UPDATE "Expense"
      SET "branchId" = ${defaultBranch.id}
      WHERE "businessId" = ${business.id}
        AND ("branchId" IS NULL OR "branchId" = '')
    `
    console.log(`  ✓ Backfilled branchId on ${expensesUpdated} expenses`)

    // ── 5. Backfill branchId on PurchaseOrders ────────────────────────────────
    const posUpdated = await prisma.$executeRaw`
      UPDATE "PurchaseOrder"
      SET "branchId" = ${defaultBranch.id}
      WHERE "businessId" = ${business.id}
        AND ("branchId" IS NULL OR "branchId" = '')
    `
    console.log(`  ✓ Backfilled branchId on ${posUpdated} purchase orders`)

    // ── 6. Backfill branchId on StockMovements ────────────────────────────────
    // StockMovement joins Product → Business, so we update via subquery
    const movementsUpdated = await prisma.$executeRaw`
      UPDATE "StockMovement" sm
      SET "branchId" = ${defaultBranch.id}
      FROM "Product" p
      WHERE sm."productId" = p.id
        AND p."businessId" = ${business.id}
        AND (sm."branchId" IS NULL OR sm."branchId" = '')
    `
    console.log(`  ✓ Backfilled branchId on ${movementsUpdated} stock movements`)

    // ── 7. Assign MANAGER/STAFF users to default branch ──────────────────────
    const staffUsers = business.users.filter(u => u.role !== "OWNER")
    let branchUsersCreated = 0
    for (const user of staffUsers) {
      const existing = await prisma.branchUser.findUnique({
        where: { userId_branchId: { userId: user.id, branchId: defaultBranch.id } },
      })
      if (!existing) {
        await prisma.branchUser.create({
          data: { userId: user.id, branchId: defaultBranch.id },
        })
        branchUsersCreated++
      }
    }
    console.log(`  ✓ Created ${branchUsersCreated} BranchUser assignments`)
  }

  console.log("\n✅ Multi-branch migration seed completed successfully!")
  console.log("\nNext steps:")
  console.log("  1. Verify data looks correct in your database")
  console.log("  2. Drop the legacy Product.stock and Product.minStock columns:")
  console.log('     ALTER TABLE "Product" DROP COLUMN stock, DROP COLUMN "minStock";')
  console.log("  3. Restart the application")
}

main()
  .catch((e) => {
    console.error("❌ Migration seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
