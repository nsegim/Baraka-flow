import { z } from "zod"

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

export const ReturnOrderSchema = z.object({
  reason:          z.string().min(1, "Reason is required").max(500),
  issueCreditNote: z.boolean().default(true),
})

export type CreateOrderInput      = z.infer<typeof CreateOrderSchema>
export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusSchema>
export type ReturnOrderInput      = z.infer<typeof ReturnOrderSchema>
