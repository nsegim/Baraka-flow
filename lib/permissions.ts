// RBAC permission matrix — single source of truth for who can do what.
// Replace ad-hoc `role === "OWNER"` checks with `can(role, action)`.

export type Role = "OWNER" | "MANAGER" | "STAFF"

export type Action =
  // Products
  | "product:read"
  | "product:create"
  | "product:update"
  | "product:delete"
  | "product:import"
  // Orders
  | "order:read"
  | "order:create"
  | "order:update"
  | "order:delete"
  | "order:return"
  // Payments
  | "payment:create"
  // Purchase orders
  | "purchase-order:read"
  | "purchase-order:create"
  | "purchase-order:update"
  | "purchase-order:receive"
  // Stock
  | "stock:adjust"
  | "stock:transfer"
  // Customers
  | "customer:read"
  | "customer:create"
  | "customer:update"
  | "customer:delete"
  // Suppliers
  | "supplier:read"
  | "supplier:create"
  | "supplier:update"
  | "supplier:delete"
  // Expenses
  | "expense:read"
  | "expense:create"
  | "expense:update"
  | "expense:delete"
  // Categories & attributes
  | "category:create"
  | "category:update"
  | "category:delete"
  | "attribute:create"
  | "attribute:update"
  | "attribute:delete"
  // Users & branches (owner only)
  | "user:create"
  | "user:update"
  | "user:delete"
  | "branch:create"
  | "branch:update"
  | "branch:delete"
  // Settings & audit (owner only)
  | "settings:update"
  | "audit:read"
  | "billing:manage"

// Which roles are allowed for each action.
// STAFF can: read anything + create orders + create customers + create payments.
// MANAGER can: everything STAFF can + manage inventory, expenses, POs, suppliers.
// OWNER can: everything.
const PERMISSIONS: Record<Action, Role[]> = {
  // Products
  "product:read":    ["OWNER", "MANAGER", "STAFF"],
  "product:create":  ["OWNER", "MANAGER"],
  "product:update":  ["OWNER", "MANAGER"],
  "product:delete":  ["OWNER"],
  "product:import":  ["OWNER", "MANAGER"],

  // Orders
  "order:read":      ["OWNER", "MANAGER", "STAFF"],
  "order:create":    ["OWNER", "MANAGER", "STAFF"],
  "order:update":    ["OWNER", "MANAGER"],
  "order:delete":    ["OWNER"],
  "order:return":    ["OWNER"],

  // Payments
  "payment:create":  ["OWNER", "MANAGER", "STAFF"],

  // Purchase orders
  "purchase-order:read":    ["OWNER", "MANAGER"],
  "purchase-order:create":  ["OWNER", "MANAGER"],
  "purchase-order:update":  ["OWNER", "MANAGER"],
  "purchase-order:receive": ["OWNER", "MANAGER"],

  // Stock
  "stock:adjust":    ["OWNER", "MANAGER"],
  "stock:transfer":  ["OWNER", "MANAGER"],

  // Customers
  "customer:read":   ["OWNER", "MANAGER", "STAFF"],
  "customer:create": ["OWNER", "MANAGER", "STAFF"],
  "customer:update": ["OWNER", "MANAGER"],
  "customer:delete": ["OWNER"],

  // Suppliers
  "supplier:read":   ["OWNER", "MANAGER"],
  "supplier:create": ["OWNER", "MANAGER"],
  "supplier:update": ["OWNER", "MANAGER"],
  "supplier:delete": ["OWNER"],

  // Expenses
  "expense:read":    ["OWNER", "MANAGER"],
  "expense:create":  ["OWNER", "MANAGER"],
  "expense:update":  ["OWNER", "MANAGER"],
  "expense:delete":  ["OWNER"],

  // Categories & attributes
  "category:create": ["OWNER", "MANAGER"],
  "category:update": ["OWNER", "MANAGER"],
  "category:delete": ["OWNER"],
  "attribute:create":["OWNER", "MANAGER"],
  "attribute:update":["OWNER", "MANAGER"],
  "attribute:delete":["OWNER"],

  // Owner-only
  "user:create":     ["OWNER"],
  "user:update":     ["OWNER"],
  "user:delete":     ["OWNER"],
  "branch:create":   ["OWNER"],
  "branch:update":   ["OWNER"],
  "branch:delete":   ["OWNER"],
  "settings:update": ["OWNER"],
  "audit:read":      ["OWNER"],
  "billing:manage":  ["OWNER"],
}

/** Returns true if `role` is permitted to perform `action`. */
export function can(role: Role, action: Action): boolean {
  return (PERMISSIONS[action] as Role[]).includes(role)
}

/** Throws if `role` is not permitted. Use inside route handlers. */
export function assertCan(role: Role, action: Action): void {
  if (!can(role, action)) {
    throw new ForbiddenError(`Role "${role}" cannot perform "${action}"`)
  }
}

// ── Typed errors — throw these in handlers, catch in handleRoute() ────────────

export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number = 500,
  ) {
    super(message)
    this.name = "AppError"
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403)
    this.name = "ForbiddenError"
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, 404)
    this.name = "NotFoundError"
  }
}

export class PlanLimitError extends AppError {
  constructor(message: string) {
    super(message, 402)
    this.name = "PlanLimitError"
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400)
    this.name = "ValidationError"
  }
}
