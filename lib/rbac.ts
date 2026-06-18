import { NextResponse } from "next/server"

type Role = "OWNER" | "MANAGER" | "STAFF"

/**
 * Returns a 403 response if the user's role is not in allowedRoles.
 * Returns null if the user is allowed — caller should continue.
 *
 * Usage:
 *   const forbidden = requireRole(session.user.role, ["OWNER", "MANAGER"])
 *   if (forbidden) return forbidden
 */
export function requireRole(
  userRole: string,
  allowedRoles: Role[]
): NextResponse | null {
  if (!allowedRoles.includes(userRole as Role)) {
    return NextResponse.json(
      { error: "You do not have permission to perform this action" },
      { status: 403 }
    )
  }
  return null
}
