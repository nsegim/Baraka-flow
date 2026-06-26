-- ============================================================
-- Baraka Flow — Platform Layer Migration
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- New enums
CREATE TYPE "PlatformRole" AS ENUM ('SUPER_ADMIN', 'SUPPORT');
CREATE TYPE "SupportAccessScope" AS ENUM ('READ_ONLY', 'FULL_IMPERSONATION');
CREATE TYPE "SupportSessionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'ENDED');
CREATE TYPE "PlatformAction" AS ENUM ('TENANT_CREATED', 'TENANT_SUSPENDED', 'TENANT_UNSUSPENDED', 'TENANT_DELETED', 'TENANT_PLAN_CHANGED', 'PLATFORM_USER_CREATED', 'PLATFORM_USER_DEACTIVATED', 'PASSWORD_RESET_INITIATED', 'SUPPORT_SESSION_OPENED', 'SUPPORT_SESSION_ENDED', 'SUPPORT_SESSION_REVOKED');

-- Drop old foreign keys that will be re-created (because branchId was made non-nullable)
ALTER TABLE "Expense"       DROP CONSTRAINT "Expense_branchId_fkey";
ALTER TABLE "Order"         DROP CONSTRAINT "Order_branchId_fkey";
ALTER TABLE "PurchaseOrder" DROP CONSTRAINT "PurchaseOrder_branchId_fkey";
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_branchId_fkey";

-- Add plan fields to Business
ALTER TABLE "Business"
  ADD COLUMN "plan"          TEXT NOT NULL DEFAULT 'starter',
  ADD COLUMN "planExpiresAt" TIMESTAMP(3);

-- Platform admin users (separate from tenant User table)
CREATE TABLE "PlatformUser" (
    "id"        TEXT         NOT NULL,
    "name"      TEXT         NOT NULL,
    "email"     TEXT         NOT NULL,
    "password"  TEXT         NOT NULL,
    "role"      "PlatformRole" NOT NULL DEFAULT 'SUPPORT',
    "isActive"  BOOLEAN      NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformUser_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlatformUser_email_key" ON "PlatformUser"("email");

-- Audited, time-bounded support access sessions
CREATE TABLE "SupportSession" (
    "id"             TEXT                   NOT NULL,
    "platformUserId" TEXT                   NOT NULL,
    "businessId"     TEXT                   NOT NULL,
    "justification"  TEXT                   NOT NULL,
    "accessScope"    "SupportAccessScope"   NOT NULL,
    "status"         "SupportSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt"      TIMESTAMP(3)           NOT NULL,
    "endedAt"        TIMESTAMP(3),
    "ipAddress"      TEXT,
    "createdAt"      TIMESTAMP(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SupportSession_businessId_idx"       ON "SupportSession"("businessId");
CREATE INDEX "SupportSession_platformUserId_idx"   ON "SupportSession"("platformUserId");
CREATE INDEX "SupportSession_status_expiresAt_idx" ON "SupportSession"("status", "expiresAt");

-- Individual actions taken during a support session
CREATE TABLE "SupportAction" (
    "id"               TEXT         NOT NULL,
    "supportSessionId" TEXT         NOT NULL,
    "action"           TEXT         NOT NULL,
    "entityType"       TEXT,
    "entityId"         TEXT,
    "metadata"         JSONB,
    "ipAddress"        TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportAction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SupportAction_supportSessionId_idx" ON "SupportAction"("supportSessionId");

-- Platform-level audit trail (separate from tenant AuditLog)
CREATE TABLE "PlatformAuditLog" (
    "id"             TEXT             NOT NULL,
    "platformUserId" TEXT,
    "action"         "PlatformAction" NOT NULL,
    "entityType"     TEXT,
    "entityId"       TEXT,
    "metadata"       JSONB,
    "ipAddress"      TEXT,
    "createdAt"      TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PlatformAuditLog_platformUserId_idx" ON "PlatformAuditLog"("platformUserId");
CREATE INDEX "PlatformAuditLog_entityId_idx"       ON "PlatformAuditLog"("entityId");
CREATE INDEX "PlatformAuditLog_createdAt_idx"      ON "PlatformAuditLog"("createdAt");

-- Re-add foreign keys for non-nullable branchId columns
ALTER TABLE "Order"         ADD CONSTRAINT "Order_branchId_fkey"         FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Expense"       ADD CONSTRAINT "Expense_branchId_fkey"       FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign keys for new tables
ALTER TABLE "SupportSession"   ADD CONSTRAINT "SupportSession_platformUserId_fkey"  FOREIGN KEY ("platformUserId")   REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportSession"   ADD CONSTRAINT "SupportSession_businessId_fkey"      FOREIGN KEY ("businessId")       REFERENCES "Business"("id")     ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportAction"    ADD CONSTRAINT "SupportAction_supportSessionId_fkey" FOREIGN KEY ("supportSessionId") REFERENCES "SupportSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlatformAuditLog" ADD CONSTRAINT "PlatformAuditLog_platformUserId_fkey" FOREIGN KEY ("platformUserId") REFERENCES "PlatformUser"("id")  ON DELETE SET NULL ON UPDATE CASCADE;
