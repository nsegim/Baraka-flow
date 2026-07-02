-- ============================================================================
-- Performance Indexes  (idempotent — safe to re-run)
-- Run in your Supabase SQL editor or psql
-- ============================================================================

-- Orders: list by business+branch sorted by date (most common query)
CREATE INDEX IF NOT EXISTS "Order_businessId_branchId_createdAt"
  ON "Order" ("businessId", "branchId", "createdAt" DESC);

-- Orders: filter by status within a branch
CREATE INDEX IF NOT EXISTS "Order_businessId_branchId_status"
  ON "Order" ("businessId", "branchId", "status");

-- Orders: payment status filter
CREATE INDEX IF NOT EXISTS "Order_businessId_branchId_paymentStatus"
  ON "Order" ("businessId", "branchId", "paymentStatus");

-- Products: list by business+category (category filter page)
CREATE INDEX IF NOT EXISTS "Product_businessId_categoryId"
  ON "Product" ("businessId", "categoryId");

-- Products: list by business+supplier (supplier filter / PO links)
CREATE INDEX IF NOT EXISTS "Product_businessId_supplierId"
  ON "Product" ("businessId", "supplierId");

-- Products: active product lookup (most listings only show active)
CREATE INDEX IF NOT EXISTS "Product_businessId_isActive"
  ON "Product" ("businessId", "isActive");

-- BranchInventory: stock level queries (low stock alerts, reports)
CREATE INDEX IF NOT EXISTS "BranchInventory_branchId_stock"
  ON "BranchInventory" ("branchId", "stock");

-- BranchInventory: batch lookup by productId (fixes N+1 in order create)
CREATE INDEX IF NOT EXISTS "BranchInventory_productId"
  ON "BranchInventory" ("productId");

-- AuditLog: activity feed (businessId + createdAt is the default sort)
CREATE INDEX IF NOT EXISTS "AuditLog_businessId_createdAt"
  ON "AuditLog" ("businessId", "createdAt" DESC);

-- AuditLog: filter by branch
CREATE INDEX IF NOT EXISTS "AuditLog_businessId_branchId"
  ON "AuditLog" ("businessId", "branchId");

-- PurchaseOrders: list by business+branch sorted by date
CREATE INDEX IF NOT EXISTS "PurchaseOrder_businessId_branchId_createdAt"
  ON "PurchaseOrder" ("businessId", "branchId", "createdAt" DESC);

-- Notifications: unread count (very frequent query)
CREATE INDEX IF NOT EXISTS "Notification_businessId_isRead"
  ON "Notification" ("businessId", "isRead");

-- StockMovement: product history (product detail page)
CREATE INDEX IF NOT EXISTS "StockMovement_productId_createdAt"
  ON "StockMovement" ("productId", "createdAt" DESC);
