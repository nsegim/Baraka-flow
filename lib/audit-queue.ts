// Batched audit-log writer.
// Accumulates entries in memory and flushes with createMany every 5 s or when
// the queue reaches FLUSH_SIZE — whichever comes first.
// Non-critical: failures are silently dropped (same contract as fire-and-forget).

import { prisma }         from "@/lib/prisma"
import type { AuditAction } from "@/lib/generated/prisma/enums"

export interface AuditEntry {
  action:     AuditAction
  entityType: string
  entityId:   string | null
  metadata:   object | undefined
  ipAddress:  string | null
  businessId: string
  branchId:   string | null
  userId:     string | null
}

const FLUSH_SIZE        = 50
const FLUSH_INTERVAL_MS = 5_000

const queue: AuditEntry[] = []
let   flushTimer: ReturnType<typeof setInterval> | null = null

function ensureTimer(): void {
  if (flushTimer !== null) return
  flushTimer = setInterval(flush, FLUSH_INTERVAL_MS)
  // Prevent the timer from keeping the process alive during graceful shutdown
  if (typeof (flushTimer as NodeJS.Timeout).unref === "function") {
    (flushTimer as NodeJS.Timeout).unref()
  }
}

function flush(): void {
  if (queue.length === 0) return
  const batch = queue.splice(0, queue.length)
  prisma.auditLog
    .createMany({ data: batch })
    .catch(() => {})
}

export function enqueueAuditLog(entry: AuditEntry): void {
  ensureTimer()
  queue.push(entry)
  if (queue.length >= FLUSH_SIZE) flush()
}
