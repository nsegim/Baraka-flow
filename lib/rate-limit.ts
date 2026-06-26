/**
 * Sliding-window in-memory rate limiter.
 *
 * Works correctly on single-server deployments (Railway, VPS, Render).
 * For multi-instance / serverless (Vercel), replace the store with
 * Upstash Redis: https://github.com/upstash/ratelimit-js
 */

interface RateLimitResult {
  success:   boolean
  limit:     number
  remaining: number
  resetAt:   Date
}

// Module-level store — persists between requests on the same Node.js process.
const store     = new Map<string, number[]>()
let lastCleanup = Date.now()

/**
 * @param identifier  Unique key, e.g. `login:${ip}` or `register:${ip}`
 * @param windowMs    Time window in milliseconds
 * @param max         Maximum requests allowed in the window
 */
export function rateLimit(
  identifier: string,
  windowMs:   number,
  max:        number,
): RateLimitResult {
  const now         = Date.now()
  const windowStart = now - windowMs

  // Prune the store every 5 minutes to prevent unbounded memory growth
  if (now - lastCleanup > 5 * 60 * 1000) {
    for (const [key, timestamps] of store.entries()) {
      const active = timestamps.filter(t => t > windowStart)
      if (active.length === 0) store.delete(key)
      else                     store.set(key, active)
    }
    lastCleanup = now
  }

  const prev   = store.get(identifier) ?? []
  const recent = prev.filter(t => t > windowStart)
  recent.push(now)
  store.set(identifier, recent)

  const success   = recent.length <= max
  const remaining = Math.max(0, max - recent.length)
  // Reset time = when the oldest request in the window falls out
  const resetAt   = new Date((recent[0] ?? now) + windowMs)

  return { success, limit: max, remaining, resetAt }
}

/** Extract caller IP from Next.js request headers. */
export function getIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  )
}

/** Build the standard 429 response body + headers. */
export function rateLimitResponse(result: RateLimitResult): Response {
  const retryAfter = Math.ceil((result.resetAt.getTime() - Date.now()) / 1000)
  return new Response(
    JSON.stringify({ error: "Too many requests. Please try again later." }),
    {
      status:  429,
      headers: {
        "Content-Type":  "application/json",
        "Retry-After":   String(retryAfter),
        "X-RateLimit-Limit":     String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset":     result.resetAt.toISOString(),
      },
    },
  )
}
