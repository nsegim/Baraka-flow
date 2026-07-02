// TenantContext — built once per request, passed to services.
// Combines auth session + branch resolution + role into one typed object.

import { NextResponse }                from "next/server"
import { requireBranchContext, isBranchContext } from "@/lib/branch-auth"
import { can, type Role, type Action } from "@/lib/permissions"

export interface TenantContext {
  businessId: string
  userId:     string
  role:       Role
  branchId:   string | null
}

/**
 * Authenticate + resolve branch + return a typed TenantContext.
 * Returns a 401/403 NextResponse on failure.
 *
 * Usage:
 *   const ctx = await buildContext(request)
 *   if (ctx instanceof NextResponse) return ctx
 */
export async function buildContext(
  request: Request,
  options?: { requireBranch?: boolean },
): Promise<TenantContext | NextResponse> {
  const raw = await requireBranchContext(request, options)
  if (!isBranchContext(raw)) return raw

  return {
    businessId: raw.session.user.businessId,
    userId:     raw.session.user.id,
    role:       raw.session.user.role as Role,
    branchId:   raw.branchId,
  }
}

/**
 * Returns a 403 response if the context role cannot perform the action.
 * Returns undefined if allowed (no return value needed from caller).
 *
 * Usage:
 *   const denied = deny(ctx, "product:create")
 *   if (denied) return denied
 */
export function deny(ctx: TenantContext, action: Action): NextResponse | undefined {
  if (!can(ctx.role, action)) {
    return NextResponse.json(
      { error: `Your role does not permit: ${action}` },
      { status: 403 },
    )
  }
}
