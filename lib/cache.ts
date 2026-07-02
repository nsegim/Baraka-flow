// In-memory cache with TTL. Redis-ready: swap MemoryCache for RedisCache
// by implementing the same CacheStore interface.

export interface CacheStore {
  get<T>(key: string): T | undefined
  set<T>(key: string, value: T, ttlMs: number): void
  del(key: string): void
  delPrefix(prefix: string): void
}

interface Entry<T> {
  value:     T
  expiresAt: number
}

const MAX_ENTRIES = 500

class MemoryCache implements CacheStore {
  private store = new Map<string, Entry<unknown>>()

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return undefined
    }
    return entry.value as T
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    if (this.store.size >= MAX_ENTRIES) this.evict()
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs })
  }

  del(key: string): void {
    this.store.delete(key)
  }

  delPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key)
    }
  }

  private evict(): void {
    const now = Date.now()
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key)
    }
  }
}

export const cache: CacheStore = new MemoryCache()

export const TTL = {
  planLimits:  5 * 60 * 1000,  // 5 minutes
  branchCtx:   1 * 60 * 1000,  // 1 minute
} as const

export function planLimitsKey(businessId: string)  { return `plan:limits:${businessId}` }
export function planUsageKey(businessId: string)    { return `plan:usage:${businessId}` }
