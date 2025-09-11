/* Simple in-memory TTL cache + ETag helper for Next.js route handlers
 * NOTE: Process memory cache; per-instance only. Keep TTLs short.
 */

import crypto from 'crypto'

export type CacheEntry = {
  value: any
  expiresAt: number
  etag?: string
  headers?: Record<string, string>
}

const store = new Map<string, CacheEntry>()

export function nowMs() { return Date.now() }

export function makeKey(parts: Array<string | number | boolean | undefined | null>): string {
  return parts.map(p => String(p ?? '')).join('|')
}

export function getCache<T = any>(key: string): { hit: boolean; value?: T; etag?: string; headers?: Record<string,string> } {
  const e = store.get(key)
  if (!e) return { hit: false }
  if (e.expiresAt <= nowMs()) { store.delete(key); return { hit: false } }
  return { hit: true, value: e.value as T, etag: e.etag, headers: e.headers }
}

export function setCache(key: string, value: any, ttlMs: number, headers?: Record<string,string>, etag?: string) {
  const expiresAt = nowMs() + Math.max(0, ttlMs)
  const entry: CacheEntry = { value, expiresAt, headers, etag }
  store.set(key, entry)
}

export function shouldBypassCache(url: string): boolean {
  try {
    const u = new URL(url, 'http://localhost')
    const v = u.searchParams.get('cache')
    const b = u.searchParams.get('_bypassCache') || u.searchParams.get('_bypass_cache')
    return v === 'false' || v === '0' || v === 'no' || v === 'off' || b === '1'
  } catch { return false }
}

export function makeETagFromObject(obj: any): string {
  try {
    const json = JSON.stringify(obj)
    return crypto.createHash('sha1').update(json).digest('hex')
  } catch {
    // Fallback to time-based ETag to avoid blocking
    return 'W/"' + Date.now().toString(36) + '"'
  }
}

export function withCacheHeaders(base?: Record<string,string>, extra?: Record<string,string>): Record<string,string> {
  return { ...(base||{}), ...(extra||{}) }
}

