import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const BRANCH_COOKIE = "bf-branch-id"
const LOCALE_COOKIE = "bf-locale"

export function middleware(req: NextRequest) {
  const isLoggedIn = !!req.cookies.get("authjs.session-token")?.value

  const url = req.nextUrl.clone()

  // ── Cookie → header forwarding for API routes ────────────────────────────
  // Forwards bf-branch-id and bf-locale cookies as request headers so
  // server-side code (branch-auth.ts, i18n/request.ts) can read them.
  if (url.pathname.startsWith("/api/")) {
    const branchCookie = req.cookies.get(BRANCH_COOKIE)?.value
    const localeCookie = req.cookies.get(LOCALE_COOKIE)?.value
    if (branchCookie || localeCookie) {
      const headers = new Headers(req.headers)
      if (branchCookie) headers.set("x-branch-id", branchCookie)
      if (localeCookie) headers.set("x-locale",    localeCookie)
      return NextResponse.next({ request: { headers } })
    }
    return NextResponse.next()
  }

  // ── Public pages ───────────────────────────────────────────────────────────
  const isPasswordResetPage =
    url.pathname.startsWith("/forgot-password") ||
    url.pathname.startsWith("/reset-password")
  if (isPasswordResetPage) return NextResponse.next()

  const isLoginPage =
    url.pathname.startsWith("/login")  ||
    url.pathname.startsWith("/register")

  // Admin routes — login check here, super-admin check in layout.
  // /admin-login is the platform-user login page and must stay publicly accessible.
  if (url.pathname.startsWith("/admin") && !url.pathname.startsWith("/admin-login") && !isLoggedIn) {
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  const isDashboard =
    url.pathname.startsWith("/dashboard")       ||
    url.pathname.startsWith("/inventory")       ||
    url.pathname.startsWith("/stock-alerts")    ||
    url.pathname.startsWith("/orders")          ||
    url.pathname.startsWith("/customers")       ||
    url.pathname.startsWith("/purchase-orders") ||
    url.pathname.startsWith("/expenses")        ||
    url.pathname.startsWith("/suppliers")       ||
    url.pathname.startsWith("/reports")         ||
    url.pathname.startsWith("/staff")           ||
    url.pathname.startsWith("/branches")        ||
    url.pathname.startsWith("/stock-transfers") ||
    url.pathname.startsWith("/audit-logs")      ||
    url.pathname.startsWith("/settings")        ||
    url.pathname.startsWith("/billing")

  if (isDashboard && !isLoggedIn) {
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  if (isLoginPage && isLoggedIn) {
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  // Include /api/* so the branch-cookie forwarding runs on API requests too
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
