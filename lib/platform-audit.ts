import { prisma } from "@/lib/prisma"
import type { PlatformAction } from "@/lib/generated/prisma/enums"

// Fire-and-forget platform audit log — records admin actions in the platform-level
// audit trail, separate from tenant AuditLog records.
export function createPlatformAuditLog(opts: {
  platformUserId?: string
  action: PlatformAction
  entityType?: string
  entityId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
}): void {
  const { platformUserId, action, entityType, entityId, metadata, ipAddress } = opts

  prisma.platformAuditLog.create({
    data: {
      action,
      entityType,
      entityId,
      metadata: metadata ? (metadata as object) : undefined,
      ipAddress,
      ...(platformUserId ? { platformUserId } : {}),
    },
  }).catch(() => {
    // Never throw — audit logging must not break the main request flow
  })
}
