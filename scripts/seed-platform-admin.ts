/**
 * One-time script to create the first PlatformUser (SUPER_ADMIN).
 * Run after applying supabase-migration-platform-layer.sql:
 *
 *   PLATFORM_ADMIN_NAME="Your Name" \
 *   PLATFORM_ADMIN_EMAIL="admin@barakaflow.rw" \
 *   PLATFORM_ADMIN_PASSWORD="YourPassword123" \
 *   npx tsx scripts/seed-platform-admin.ts
 */

import { config } from "dotenv"
import { resolve } from "path"
config({ path: resolve(process.cwd(), ".env") })

import { PrismaClient } from "../lib/generated/prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const name     = process.env.PLATFORM_ADMIN_NAME     ?? "Platform Admin"
  const email    = process.env.PLATFORM_ADMIN_EMAIL    ?? process.env.SUPER_ADMIN_EMAIL ?? ""
  const password = process.env.PLATFORM_ADMIN_PASSWORD ?? ""

  if (!email || !password) {
    console.error("Missing required env vars: PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD")
    process.exit(1)
  }

  const existing = await prisma.platformUser.findUnique({ where: { email } })
  if (existing) {
    console.log(`PlatformUser already exists: ${existing.email} (${existing.role})`)
    process.exit(0)
  }

  const hashed = await bcrypt.hash(password, 12)

  const pu = await prisma.platformUser.create({
    data: { name, email, password: hashed, role: "SUPER_ADMIN" },
  })

  console.log(`✅ Created PlatformUser: ${pu.name} (${pu.email}) — ${pu.role}`)
  console.log(`   You can now log in at /admin-login`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
