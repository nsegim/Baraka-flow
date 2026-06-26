-- ─────────────────────────────────────────────────────────────────────────────
-- Multi-branch migration seed — run in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  biz        RECORD;
  branch_id  TEXT;
  prod       RECORD;
  usr        RECORD;
BEGIN

  FOR biz IN SELECT id, name FROM "Business" LOOP

    RAISE NOTICE 'Processing business: % (%)', biz.name, biz.id;

    -- ── 1. Create default branch ────────────────────────────────────────────
    SELECT id INTO branch_id
    FROM   "Branch"
    WHERE  "businessId" = biz.id AND "isDefault" = true
    LIMIT  1;

    IF branch_id IS NULL THEN
      branch_id := gen_random_uuid()::text;
      INSERT INTO "Branch"
        (id, name, code, "isDefault", "isActive", "businessId", "createdAt", "updatedAt")
      VALUES
        (branch_id, 'Main Branch', 'HQ', true, true, biz.id, NOW(), NOW());
      RAISE NOTICE '  + Created default branch (id=%)', branch_id;
    ELSE
      RAISE NOTICE '  = Default branch already exists (id=%)', branch_id;
    END IF;

    -- ── 2. Seed BranchInventory (only: id, branchId, productId, stock, minStock) ──
    FOR prod IN SELECT id FROM "Product" WHERE "businessId" = biz.id LOOP
      INSERT INTO "BranchInventory"
        (id, "branchId", "productId", stock, "minStock")
      VALUES
        (gen_random_uuid()::text, branch_id, prod.id, 0, 0)
      ON CONFLICT ("branchId", "productId") DO NOTHING;
    END LOOP;
    RAISE NOTICE '  + BranchInventory rows seeded';

    -- ── 3. Back-fill branchId on existing records ────────────────────────────
    UPDATE "Order"
    SET    "branchId" = branch_id
    WHERE  "businessId" = biz.id AND "branchId" IS NULL;
    RAISE NOTICE '  + Orders back-filled';

    UPDATE "Expense"
    SET    "branchId" = branch_id
    WHERE  "businessId" = biz.id AND "branchId" IS NULL;
    RAISE NOTICE '  + Expenses back-filled';

    UPDATE "PurchaseOrder"
    SET    "branchId" = branch_id
    WHERE  "businessId" = biz.id AND "branchId" IS NULL;
    RAISE NOTICE '  + PurchaseOrders back-filled';

    UPDATE "StockMovement" AS sm
    SET    "branchId" = branch_id
    FROM   "Product" AS p
    WHERE  sm."productId" = p.id
      AND  p."businessId" = biz.id
      AND  sm."branchId"  IS NULL;
    RAISE NOTICE '  + StockMovements back-filled';

    UPDATE "Customer"
    SET    "branchId" = branch_id
    WHERE  "businessId" = biz.id AND "branchId" IS NULL;

    UPDATE "Notification"
    SET    "branchId" = branch_id
    WHERE  "businessId" = biz.id AND "branchId" IS NULL;

    UPDATE "AuditLog"
    SET    "branchId" = branch_id
    WHERE  "businessId" = biz.id AND "branchId" IS NULL;
    RAISE NOTICE '  + Customers/Notifications/AuditLogs back-filled';

    -- ── 4. Assign non-OWNER users to the default branch ──────────────────────
    FOR usr IN
      SELECT id FROM "User"
      WHERE  "businessId" = biz.id AND role IN ('MANAGER', 'STAFF')
    LOOP
      INSERT INTO "BranchUser"
        (id, "userId", "branchId", "assignedAt")
      VALUES
        (gen_random_uuid()::text, usr.id, branch_id, NOW())
      ON CONFLICT ("userId", "branchId") DO NOTHING;
    END LOOP;
    RAISE NOTICE '  + BranchUser assignments created';

  END LOOP;

  RAISE NOTICE 'Seed complete.';

END $$;
