import type { AuditAction } from "@/lib/generated/prisma/enums"
import { enqueueAuditLog }  from "@/lib/audit-queue"

interface CreateAuditLogOptions {
  businessId: string
  branchId?:  string | null
  userId:     string | null | undefined
  action:     AuditAction
  entityType: string
  entityId?:  string
  metadata?:  Record<string, unknown>
  ipAddress?: string
}

export function createAuditLog(options: CreateAuditLogOptions): void {
  enqueueAuditLog({
    action:     options.action,
    entityType: options.entityType,
    entityId:   options.entityId  ?? null,
    metadata:   options.metadata ? (options.metadata as object) : undefined,
    ipAddress:  options.ipAddress ?? null,
    businessId: options.businessId,
    branchId:   options.branchId  ?? null,
    userId:     options.userId    ?? null,
  })
}
