// Named select/include constants — single source of truth for what each query
// fetches. Prevents accidental SELECT * and makes future narrowing easy.

// ── Product ──────────────────────────────────────────────────────────────────

export const PRODUCT_LIST_SELECT = {
  id:          true,
  name:        true,
  sku:         true,
  sellingPrice: true,
  costPrice:   true,
  taxable:     true,
  isActive:    true,
  createdAt:   true,
  categoryId:  true,
  supplierId:  true,
  barcode:     true,
  description: true,
  origin:      true,
} as const

// For order items: only fields needed for display / email
export const PRODUCT_ORDER_ITEM_SELECT = {
  id:          true,
  name:        true,
  sku:         true,
  sellingPrice: true,
} as const

// ── Order ────────────────────────────────────────────────────────────────────

export const ORDER_LIST_INCLUDE = {
  items: {
    include: {
      product: { select: PRODUCT_ORDER_ITEM_SELECT },
    },
  },
  user:     { select: { name: true } },
  payments: {
    select:  { id: true, amount: true, method: true, paidAt: true },
    orderBy: { paidAt: "desc" as const },
  },
  branch:   { select: { name: true, code: true } },
} as const

// For the POST response — same as list but include costPrice for margin tracking
export const ORDER_CREATE_INCLUDE = {
  items: {
    include: {
      product: { select: { ...PRODUCT_ORDER_ITEM_SELECT, costPrice: true } },
    },
  },
  user:   { select: { name: true } },
  branch: { select: { name: true, code: true } },
} as const

// ── Payment ──────────────────────────────────────────────────────────────────

export const PAYMENT_SELECT = {
  id:     true,
  amount: true,
  method: true,
  paidAt: true,
} as const
