import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(req: NextRequest) {
  // NextAuth v5 stores the session in this specific cookie
  const isLoggedIn = !!req.cookies.get("authjs.session-token")?.value
  

  const url = req.nextUrl.clone()

  // Pages that redirect logged-in users away (login/register only — NOT /suspended)
  const isLoginPage =
    url.pathname.startsWith("/login") ||
    url.pathname.startsWith("/register")

  // Admin routes — login check here, super-admin check happens in the layout
  if (url.pathname.startsWith("/admin") && !isLoggedIn) {
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
    url.pathname.startsWith("/settings")

  // Not logged in → redirect to login
  if (isDashboard && !isLoggedIn) {
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // Already logged in → skip login/register pages (but NOT /suspended)
  if (isLoginPage && isLoggedIn) {
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
  
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}