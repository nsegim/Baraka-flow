-- ============================================================================
-- Migration: Billing Transactions  (idempotent — safe to re-run)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "BillingTransaction" (
  "id"         TEXT          NOT NULL,
  "businessId" TEXT          NOT NULL,
  "planId"     TEXT          NOT NULL,
  "amount"     DECIMAL(12,2) NOT NULL,
  "currency"   TEXT          NOT NULL,
  "txRef"      TEXT          NOT NULL,
  "flwTxId"    TEXT,
  "status"     TEXT          NOT NULL DEFAULT 'success',
  "paidAt"     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BillingTransaction_txRef_key" ON "BillingTransaction" ("txRef");
CREATE INDEX        IF NOT EXISTS "BillingTransaction_businessId"  ON "BillingTransaction" ("businessId");

DO $$ BEGIN
  ALTER TABLE "BillingTransaction"
    ADD CONSTRAINT "BillingTransaction_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "BillingTransaction"
    ADD CONSTRAINT "BillingTransaction_planId_fkey"
      FOREIGN KEY ("planId") REFERENCES "Plan"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
