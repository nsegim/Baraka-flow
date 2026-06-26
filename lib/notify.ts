import { prisma } from "@/lib/prisma"
import type { NotificationType } from "@/lib/generated/prisma/enums"

export function createNotification(
  businessId: string,
  type:       NotificationType,
  title:      string,
  message:    string,
  link?:      string,
  branchId?:  string | null,
) {
  prisma.notification.create({
    data: {
      businessId,
      branchId: branchId ?? null,
      type,
      title,
      message,
      link: link ?? null,
    },
  }).catch(() => {})
}
