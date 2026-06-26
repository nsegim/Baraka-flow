import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import type { Session } from "next-auth"

export type BranchContext =
  | { session: Session; branchId: string | null; isOwner: false }
  | { session: Session; branchId: string | null; isOwner: true }

/**
 * Resolves the active branchId for an incoming request.
 *
 * OWNER:
 *   - Reads x-branch-id header (set by the frontend branch-selector).
 *   - If "all" or missing → branchId is null (cross-branch query).
 *   - If a specific branchId is provided, validates it belongs to this business.
 *
 * MANAGER / STAFF:
 *   - branchId is always read from their BranchUser assignment in the DB.
 *   - Client-supplied branchId is never trusted for non-owners.
 *   - Returns null if the user has no branch assignment (should not happen
 *     after migration, but handled gracefully → caller returns 403).
 *
 * Returns null when the request is unauthenticated.
 */
export async function resolveBranchContext(
  request: Request,
): Promise<BranchContext | null> {
  const session = await auth()
  if (!session) return null

  if (session.user.role === "OWNER") {
    const requestedId = request.headers.get("x-branch-id")

    if (!requestedId || requestedId === "all") {
      return { session, branchId: null, isOwner: true }
    }

    // Validate the requested branch belongs to this owner's business
    const branch = await prisma.branch.findFirst({
      where: { id: requestedId, businessId: session.user.businessId, isActive: true },
      select: { id: true },
    })
    if (!branch) {
      // Requested branch not found or belongs to another business — fall back to all
      return { session, branchId: null, isOwner: true }
    }
    return { session, branchId: branch.id, isOwner: true }
  }

  // MANAGER / STAFF — always use their session-stored branchId (refreshed from DB on each auth())
  const branchId = session.user.branchId ?? null
  return { session, branchId, isOwner: false }
}

/**
 * Builds a Prisma `where` clause that correctly scopes data to the
 * current branch context.
 *
 * - OWNER with no branch selected (branchId=null): filters by businessId only
 *   → returns data across all branches.
 * - Everyone else: filters by businessId AND branchId.
 */
export function buildBranchWhere(
  ctx: BranchContext,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const base: Record<string, unknown> = { businessId: ctx.session.user.businessId }
  if (ctx.branchId) base.branchId = ctx.branchId
  return { ...base, ...extra }
}

/**
 * Shorthand: authenticate + resolve branch context in one call.
 * Returns a 401/403 NextResponse on failure, or the context on success.
 */
export async function requireBranchContext(
  request: Request,
  options?: { requireBranch?: boolean },
): Promise<BranchContext | NextResponse> {
  const ctx = await resolveBranchContext(request)

  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // If caller requires a specific branch (e.g. write operations for MANAGER/STAFF)
  if (options?.requireBranch && !ctx.branchId) {
    return NextResponse.json(
      { error: "No branch assigned. Ask your administrator to assign you to a branch." },
      { status: 403 }
    )
  }

  return ctx
}

/**
 * Type-guard: narrows the result of requireBranchContext to BranchContext.
 */
export function isBranchContext(
  value: BranchContext | NextResponse,
): value is BranchContext {
  return !(value instanceof NextResponse)
}

/**
 * Returns the branchId that should be written on new records created by this user.
 * OWNER creating in a specific branch context → uses that branchId.
 * OWNER with no branch selected → must pass a branchId explicitly (UI handles this).
 * MANAGER/STAFF → always their assigned branch.
 */
export function getWriteBranchId(
  ctx: BranchContext,
  explicitBranchId?: string | null,
): string | null {
  if (ctx.isOwner) {
    return ctx.branchId ?? explicitBranchId ?? null
  }
  return ctx.branchId
}
