import { z } from "zod"

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
  attributes:  z.record(z.string(), z.unknown()).optional().nullable(),
  attributeValues: z.array(z.object({
    templateId: z.cuid("Invalid attribute template ID"),
    value:      z.string().max(1000, "Attribute value too long"),
  })).optional(),
})

export const UpdateProductSchema = CreateProductSchema.partial().extend({
  stockReason: z.string().max(500).optional(),
})

export type CreateProductInput = z.infer<typeof CreateProductSchema>
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>
