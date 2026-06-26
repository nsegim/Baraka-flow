import { NextRequest } from "next/server"
import { handlers } from "@/lib/auth"
import { rateLimit, getIp, rateLimitResponse } from "@/lib/rate-limit"

// GET handler — no rate limiting needed (session, csrf, etc.)
export const GET = handlers.GET

// POST handler — rate limit login attempts only
export async function POST(request: NextRequest) {
  const url = new URL(request.url)

  // NextAuth's credentials login goes to /api/auth/callback/credentials
  if (url.pathname.endsWith("/callback/credentials")) {
    const ip     = getIp(request)
    const result = rateLimit(`login:${ip}`, 15 * 60 * 1000, 10) // 10 per 15 min
    if (!result.success) return rateLimitResponse(result)
  }

  return handlers.POST(request)
}
