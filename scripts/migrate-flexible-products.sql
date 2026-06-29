-- ============================================================================
-- Migration: Flexible Product Attributes  (idempotent — safe to re-run)
-- ============================================================================
-- Uses DO $$ BEGIN ... EXCEPTION ... END $$ blocks for things that don't
-- support IF NOT EXISTS natively in PostgreSQL (types, FK constraints).
-- CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS are used everywhere.
-- ============================================================================

-- 1. New enum for attribute value types (safe to re-run)
DO $$ BEGIN
  CREATE TYPE "AttributeType" AS ENUM ('TEXT', 'NUMBER', 'BOOLEAN', 'SELECT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add flexible JSON blob directly on Product (IF NOT EXISTS = safe to re-run)
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "attributes" JSONB;

-- 3. Tenant-defined attribute schema table
CREATE TABLE IF NOT EXISTS "AttributeTemplate" (
  "id"         TEXT             NOT NULL,
  "name"       TEXT             NOT NULL,
  "key"        TEXT             NOT NULL,
  "type"       "AttributeType"  NOT NULL DEFAULT 'TEXT',
  "options"    JSONB,
  "unit"       TEXT,
  "isRequired" BOOLEAN          NOT NULL DEFAULT false,
  "sortOrder"  INTEGER          NOT NULL DEFAULT 0,
  "isActive"   BOOLEAN          NOT NULL DEFAULT true,
  "businessId" TEXT             NOT NULL,
  "categoryId" TEXT,
  "createdAt"  TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttributeTemplate_pkey" PRIMARY KEY ("id")
);

-- Unique key: (businessId, key) per categoryId scope
-- COALESCE treats NULL categoryId as '' so two global templates with same key are blocked.
CREATE UNIQUE INDEX IF NOT EXISTS "attribute_template_key_unique"
  ON "AttributeTemplate" ("businessId", "key", COALESCE("categoryId", ''));

CREATE INDEX IF NOT EXISTS "AttributeTemplate_businessId_idx"
  ON "AttributeTemplate" ("businessId");
CREATE INDEX IF NOT EXISTS "AttributeTemplate_businessId_categoryId_idx"
  ON "AttributeTemplate" ("businessId", "categoryId");
CREATE INDEX IF NOT EXISTS "AttributeTemplate_businessId_isActive_idx"
  ON "AttributeTemplate" ("businessId", "isActive");

-- Foreign keys — wrapped in DO blocks so re-runs are safe
DO $$ BEGIN
  ALTER TABLE "AttributeTemplate"
    ADD CONSTRAINT "AttributeTemplate_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AttributeTemplate"
    ADD CONSTRAINT "AttributeTemplate_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Per-product structured attribute values (queryable, filterable)
CREATE TABLE IF NOT EXISTS "ProductAttributeValue" (
  "id"                  TEXT          NOT NULL,
  "productId"           TEXT          NOT NULL,
  "attributeTemplateId" TEXT          NOT NULL,
  "value"               VARCHAR(1000) NOT NULL,
  CONSTRAINT "ProductAttributeValue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductAttributeValue_productId_attributeTemplateId_key"
  ON "ProductAttributeValue" ("productId", "attributeTemplateId");
CREATE INDEX IF NOT EXISTS "ProductAttributeValue_productId_idx"
  ON "ProductAttributeValue" ("productId");
CREATE INDEX IF NOT EXISTS "ProductAttributeValue_attributeTemplateId_idx"
  ON "ProductAttributeValue" ("attributeTemplateId");
CREATE INDEX IF NOT EXISTS "ProductAttributeValue_templateId_value_idx"
  ON "ProductAttributeValue" ("attributeTemplateId", "value");

DO $$ BEGIN
  ALTER TABLE "ProductAttributeValue"
    ADD CONSTRAINT "ProductAttributeValue_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ProductAttributeValue"
    ADD CONSTRAINT "ProductAttributeValue_attributeTemplateId_fkey"
      FOREIGN KEY ("attributeTemplateId") REFERENCES "AttributeTemplate"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. New AuditAction enum values (IF NOT EXISTS = safe to re-run)
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ATTRIBUTE_TEMPLATE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ATTRIBUTE_TEMPLATE_UPDATED';
