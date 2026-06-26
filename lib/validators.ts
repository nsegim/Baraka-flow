import { z } from "zod"

// ── AUTH ──────────────────────────────────────────────────────────────────────

export const RegisterSchema = z.object({
  name:         z.string().min(2, "Name must be at least 2 characters").max(100),
  email:        z.email("Invalid email address"),
  password:     z.string().min(8, "Password must be at least 8 characters").max(100),
  businessName: z.string().min(2, "Business name must be at least 2 characters").max(200),
})

// ── PRODUCTS ──────────────────────────────────────────────────────────────────

export const CreateProductSchema = z.object({
  name:        z.string().min(1, "Product name is required").max(200),
  description: z.string().max(1000).optional().nullable(),
  sku:         z.string().max(100).optional().nullable(),
  price:       z.coerce.number({ error: "Price must be a number" })
                       .positive("Price must be positive"),
  costPrice:   z.coerce.number().positive("Cost price must be positive").optional().nullable(),
  stock:       z.coerce.number().int().min(0, "Stock cannot be negative").default(0),
  minStock:    z.coerce.number().int().min(0, "Min stock cannot be negative").default(5),
  unit:        z.string().max(50).default("piece"),
  origin:      z.string().max(100).optional().nullable(),
  categoryId:  z.cuid("Invalid category").optional().nullable(),
  supplierId:  z.cuid("Invalid supplier").optional().nullable(),
})

export const UpdateProductSchema = CreateProductSchema.partial().extend({
  stockReason: z.string().max(500).optional(),
})

// ── ORDERS ────────────────────────────────────────────────────────────────────

export const CreateOrderSchema = z.object({
  customerName:  z.string().min(1, "Customer name is required").max(200),
  customerPhone: z.string().max(50).optional().nullable(),
  customerId:    z.cuid().optional().nullable(),
  paymentTerms:  z.enum(["COD", "NET_7", "NET_14", "NET_30", "NET_60"]).default("COD"),
  notes:         z.string().max(1000).optional().nullable(),
  items: z.array(z.object({
    productId: z.cuid("Invalid product ID"),
    quantity:  z.number().int().positive("Quantity must be at least 1"),
    unitPrice: z.number().nonnegative("Unit price cannot be negative"),
  })).min(1, "Order must have at least one item"),
})

export const UpdateOrderStatusSchema = z.object({
  status:        z.enum(["PENDING", "CONFIRMED", "DELIVERED", "CANCELLED"]),
  deliveryNotes: z.string().max(500).optional().nullable(),
})

// ── SUPPLIERS ─────────────────────────────────────────────────────────────────

const emailField = z
  .union([z.email("Invalid email address"), z.literal(""), z.null()])
  .optional()
  .transform(v => (v === "" ? null : v))

export const CreateSupplierSchema = z.object({
  name:    z.string().min(1, "Supplier name is required").max(200),
  email:   emailField,
  phone:   z.string().max(50).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
})

export const UpdateSupplierSchema = z.object({
  name:    z.string().min(1).max(200).optional(),
  email:   emailField,
  phone:   z.string().max(50).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
})

// ── CATEGORIES ────────────────────────────────────────────────────────────────

export const CreateCategorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(100),
})

export const UpdateCategorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(100),
})

// ── CUSTOMERS ─────────────────────────────────────────────────────────────────

export const CreateCustomerSchema = z.object({
  name:    z.string().min(1, "Customer name is required").max(200),
  phone:   z.string().max(50).optional().nullable(),
  email:   z.union([z.email("Invalid email"), z.literal(""), z.null()])
             .optional()
             .transform(v => (v === "" ? null : v)),
  address: z.string().max(500).optional().nullable(),
  notes:   z.string().max(1000).optional().nullable(),
})

export const UpdateCustomerSchema = CreateCustomerSchema.partial()

// ── PAYMENTS ──────────────────────────────────────────────────────────────────

export const CreatePaymentSchema = z.object({
  orderId:   z.cuid("Invalid order ID"),
  amount:    z.number().positive("Payment amount must be positive"),
  method:    z.enum(["CASH", "MOBILE_MONEY", "BANK_TRANSFER", "CREDIT"]),
  reference: z.string().max(200).optional().nullable(),
  notes:     z.string().max(500).optional().nullable(),
})

// ── EXPENSES ──────────────────────────────────────────────────────────────────

export const CreateExpenseSchema = z.object({
  title:    z.string().min(1, "Title is required").max(200),
  amount:   z.number().positive("Amount must be positive"),
  category: z.enum(["RENT", "UTILITIES", "TRANSPORT", "STAFF_WAGES", "MARKETING", "EQUIPMENT", "OTHER"]),
  date:     z.string().min(1, "Date is required"),
  notes:    z.string().max(1000).optional().nullable(),
})

export const UpdateExpenseSchema = CreateExpenseSchema.partial()

// ── PURCHASE ORDERS ───────────────────────────────────────────────────────────

export const CreatePurchaseOrderSchema = z.object({
  supplierId:   z.cuid("Invalid supplier"),
  expectedDate: z.string().optional().nullable(),
  notes:        z.string().max(1000).optional().nullable(),
  items: z.array(z.object({
    productId: z.cuid("Invalid product"),
    quantity:  z.number().int().positive("Quantity must be at least 1"),
    unitCost:  z.number().nonnegative("Unit cost cannot be negative"),
  })).min(1, "Purchase order must have at least one item"),
})

export const UpdatePurchaseOrderStatusSchema = z.object({
  status: z.enum(["DRAFT", "SENT", "CONFIRMED", "RECEIVED", "CANCELLED"]),
})

// ── BUSINESS PROFILE ──────────────────────────────────────────────────────────

export const UpdateBusinessSchema = z.object({
  name:    z.string().min(2).max(200).optional(),
  phone:   z.string().max(50).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  logoUrl: z.url("Invalid URL").optional().nullable(),
  taxRate: z.coerce.number().min(0).max(1, "Tax rate must be 0–1 (e.g. 0.18 for 18%)").optional(),
})

// ── USER MANAGEMENT ───────────────────────────────────────────────────────────

export const UpdateUserRoleSchema = z.object({
  role: z.enum(["OWNER", "MANAGER", "STAFF"]),
})

export const CreateStaffSchema = z.object({
  name:     z.string().min(2).max(100),
  email:    z.email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role:     z.enum(["MANAGER", "STAFF"]),
})

// ── BRANCHES ──────────────────────────────────────────────────────────────────

export const CreateBranchSchema = z.object({
  name:    z.string().min(2, "Branch name must be at least 2 characters").max(200),
  code:    z.string().min(1, "Branch code is required").max(10).toUpperCase()
             .regex(/^[A-Z0-9]+$/, "Code must contain only letters and numbers"),
  address: z.string().max(500).optional().nullable(),
  phone:   z.string().max(50).optional().nullable(),
})

export const UpdateBranchSchema = z.object({
  name:     z.string().min(2).max(200).optional(),
  address:  z.string().max(500).optional().nullable(),
  phone:    z.string().max(50).optional().nullable(),
  isActive: z.boolean().optional(),
})

export const AssignBranchUserSchema = z.object({
  userId: z.cuid("Invalid user ID"),
})

// ── STOCK TRANSFERS ───────────────────────────────────────────────────────────

export const CreateStockTransferSchema = z.object({
  fromBranchId: z.cuid("Invalid source branch"),
  toBranchId:   z.cuid("Invalid destination branch"),
  productId:    z.cuid("Invalid product"),
  quantity:     z.number().int().positive("Quantity must be at least 1"),
  notes:        z.string().max(500).optional().nullable(),
})

export const UpdateStockTransferSchema = z.object({
  status: z.enum(["APPROVED", "COMPLETED", "REJECTED"]),
  notes:  z.string().max(500).optional().nullable(),
})
