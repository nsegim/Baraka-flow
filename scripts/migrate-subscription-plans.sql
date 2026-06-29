-- ============================================================================
-- Migration: Subscription Plans  (idempotent — safe to re-run)
-- ============================================================================

-- 1. SubscriptionStatus enum
DO $$ BEGIN
  CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL','ACTIVE','SUSPENDED','EXPIRED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Plan table
CREATE TABLE IF NOT EXISTS "Plan" (
  "id"          TEXT             NOT NULL,
  "name"        TEXT             NOT NULL,
  "slug"        TEXT             NOT NULL,
  "description" TEXT,
  "price"       DECIMAL(10,2)    NOT NULL DEFAULT 0,
  "currency"    TEXT             NOT NULL DEFAULT 'RWF',
  "maxUsers"    INTEGER,
  "maxProducts" INTEGER,
  "maxOrders"   INTEGER,
  "maxBranches" INTEGER,
  "features"    JSONB            NOT NULL DEFAULT '{}',
  "isActive"    BOOLEAN          NOT NULL DEFAULT true,
  "isPublic"    BOOLEAN          NOT NULL DEFAULT true,
  "sortOrder"   INTEGER          NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Plan_name_key"  ON "Plan" ("name");
CREATE UNIQUE INDEX IF NOT EXISTS "Plan_slug_key"  ON "Plan" ("slug");
CREATE INDEX        IF NOT EXISTS "Plan_isActive"  ON "Plan" ("isActive");

-- 3. Business: new columns
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "planId"             TEXT;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL';
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "trialEndsAt"        TIMESTAMP(3);
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "maxOrders"          INTEGER;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "maxBranches"        INTEGER;

-- FK from Business → Plan
DO $$ BEGIN
  ALTER TABLE "Business"
    ADD CONSTRAINT "Business_planId_fkey"
      FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Business_planId_idx" ON "Business" ("planId");

-- 4. New AuditAction values
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_CHANGED';

-- 5. New PlatformAction values
ALTER TYPE "PlatformAction" ADD VALUE IF NOT EXISTS 'PLAN_CREATED';
ALTER TYPE "PlatformAction" ADD VALUE IF NOT EXISTS 'PLAN_UPDATED';
ALTER TYPE "PlatformAction" ADD VALUE IF NOT EXISTS 'PLAN_DELETED';

-- 6. Seed default plans (upsert-safe using ON CONFLICT)
INSERT INTO "Plan" ("id","name","slug","description","price","currency","maxUsers","maxProducts","maxOrders","maxBranches","features","isActive","isPublic","sortOrder","createdAt","updatedAt")
VALUES
  (
    'plan_free_001', 'Free', 'free',
    'Get started at no cost. Perfect for small shops trying out BarakaFlow.',
    0, 'RWF', 3, 100, 200, 1,
    '{"advancedReports":false,"apiAccess":false,"multiBranch":false,"customBranding":false,"prioritySupport":false}',
    true, true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'plan_starter_001', 'Starter', 'starter',
    'Ideal for growing businesses with up to 5 staff and 500 products.',
    15000, 'RWF', 5, 500, 1000, 2,
    '{"advancedReports":true,"apiAccess":false,"multiBranch":false,"customBranding":false,"prioritySupport":false}',
    true, true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'plan_pro_001', 'Pro', 'pro',
    'For established businesses that need multi-branch and API access.',
    35000, 'RWF', 20, 5000, NULL, 5,
    '{"advancedReports":true,"apiAccess":true,"multiBranch":true,"customBranding":false,"prioritySupport":true}',
    true, true, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'plan_enterprise_001', 'Enterprise', 'enterprise',
    'Unlimited scale with all features, custom branding, and dedicated support.',
    100000, 'RWF', NULL, NULL, NULL, NULL,
    '{"advancedReports":true,"apiAccess":true,"multiBranch":true,"customBranding":true,"prioritySupport":true}',
    true, false, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  )
ON CONFLICT ("slug") DO NOTHING;
