import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

// Returns the session if the caller is the super admin, otherwise returns a 403 response.
// Usage in API routes:
//   const result = await requireSuperAdmin()
//   if (result instanceof NextResponse) return result
//   const session = result
export async function requireSuperAdmin() {
  const session = await auth()
  const adminEmail = process.env.SUPER_ADMIN_EMAIL

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!adminEmail || session.user.email !== adminEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return session
}

export function isSuperAdmin(email: string | null | undefined): boolean {
  const adminEmail = process.env.SUPER_ADMIN_EMAIL
  return !!adminEmail && !!email && email === adminEmail
}
