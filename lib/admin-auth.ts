import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

// Returns the session if the caller is a platform admin (SUPER_ADMIN role),
// or falls back to the legacy SUPER_ADMIN_EMAIL env-var check during transition.
// Usage in API routes:
//   const result = await requireSuperAdmin()
//   if (result instanceof NextResponse) return result
//   const session = result
export async function requireSuperAdmin() {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const isPlatformAdmin = session.user.isPlatformUser && session.user.platformRole === "SUPER_ADMIN"
  const isLegacyAdmin   = isSuperAdmin(session.user.email)

  if (!isPlatformAdmin && !isLegacyAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  return session
}

// Returns the platform user ID for audit logging, or undefined for legacy admin sessions.
export async function getPlatformUserId(): Promise<string | undefined> {
  const session = await auth()
  if (!session) return undefined
  if (session.user.isPlatformUser) return session.user.id
  return undefined
}

// Legacy email check — kept for backward compatibility during the migration from
// SUPER_ADMIN_EMAIL to PlatformUser accounts. Remove once all admins have PlatformUser records.
export function isSuperAdmin(email: string | null | undefined): boolean {
  const adminEmail = process.env.SUPER_ADMIN_EMAIL
  return !!adminEmail && !!email && email === adminEmail
}
