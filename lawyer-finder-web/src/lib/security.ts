/**
 * ── Security Utilities ──────────────────────────────────────────────────────
 * Shared sanitization, validation, and rate-limiting helpers for API routes.
 * OWASP-aligned: prevents XSS, injection, DoS, and information leakage.
 */

import { sanitizeString, sanitizeHtml } from './sanitize';
export { sanitizeString, sanitizeHtml };

// ── UUID Validation ─────────────────────────────────────────────────────────

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate a string is a proper UUID format.
 * Returns the UUID if valid, null otherwise.
 */
export function validateUUID(id: string | null | undefined): string | null {
  if (!id || typeof id !== 'string') return null;
  return UUID_V4_REGEX.test(id) ? id : null;
}

/**
 * Returns true if the string is a valid UUID.
 */
export function isValidUUID(id: string | null | undefined): boolean {
  return validateUUID(id) !== null;
}

// ── Pagination Validation ───────────────────────────────────────────────────

/**
 * Clamp and validate pagination parameters to safe integer ranges.
 * Prevents DoS via absurdly large page/limit values.
 */
export function validatePaginationParams(
  rawPage: string | number | null | undefined,
  rawLimit: string | number | null | undefined,
  defaults = { page: 1, limit: 20, maxLimit: 100 }
): { page: number; limit: number } {
  let page = typeof rawPage === 'string' ? parseInt(rawPage, 10) : Number(rawPage ?? defaults.page);
  let limit = typeof rawLimit === 'string' ? parseInt(rawLimit, 10) : Number(rawLimit ?? defaults.limit);

  if (isNaN(page) || page < 1) page = defaults.page;
  if (isNaN(limit) || limit < 1) limit = defaults.limit;
  if (limit > defaults.maxLimit) limit = defaults.maxLimit;

  return { page, limit };
}

// ── Rate Limiter (In-Memory) ────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupExpiredEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * In-memory rate limiter. Returns { allowed: boolean, remaining: number, retryAfterMs: number }.
 * For production, replace with Redis-backed implementation.
 *
 * @param key       Unique identifier (e.g. `login:${ip}` or `register:${ip}`)
 * @param maxAttempts  Maximum allowed requests within the window
 * @param windowMs     Time window in milliseconds
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  cleanupExpiredEntries();

  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt <= now) {
    // First request or window expired
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxAttempts - 1, retryAfterMs: 0 };
  }

  if (entry.count >= maxAttempts) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: entry.resetAt - now,
    };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: maxAttempts - entry.count,
    retryAfterMs: 0,
  };
}

// ── Filename Sanitization ───────────────────────────────────────────────────

/**
 * Sanitize a filename to prevent path traversal and injection attacks.
 * Strips directory separators, null bytes, and suspicious characters.
 */
export function sanitizeFilename(name: string): string {
  if (!name || typeof name !== 'string') return 'unnamed';
  return name
    .replace(/\0/g, '')       // Remove null bytes
    .replace(/\.\./g, '')                 // Remove path traversal
    .replace(/[/\\]/g, '')                // Remove directory separators
    .replace(/[<>:"|?*]/g, '')            // Remove reserved characters
    .replace(/\s+/g, '-')                 // Replace whitespace with hyphens
    .replace(/^\.+/, '')                  // Remove leading dots (hidden files)
    .slice(0, 200)                        // Cap filename length
    || 'unnamed';
}

// ── File Magic Byte Validation ──────────────────────────────────────────────

const MAGIC_BYTES: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF header (WebP starts with RIFF)
};

/**
 * Validate file content matches declared MIME type by checking magic bytes.
 * Prevents MIME type spoofing attacks.
 */
export function validateFileMagicBytes(buffer: Buffer, declaredType: string): boolean {
  const signatures = MAGIC_BYTES[declaredType];
  if (!signatures) return false;

  return signatures.some((sig) =>
    sig.every((byte, index) => buffer[index] === byte)
  );
}

// ── Sensitive Field Stripping ───────────────────────────────────────────────

/**
 * Strip sensitive fields from an object before logging or returning in responses.
 */
export function stripSensitiveFields<T extends Record<string, unknown>>(
  obj: T,
  fieldsToStrip: string[]
): Partial<T> {
  const cleaned = { ...obj };
  for (const field of fieldsToStrip) {
    if (field in cleaned) {
      delete cleaned[field];
    }
  }
  return cleaned;
}

// ── IP Extraction ───────────────────────────────────────────────────────────

/**
 * Extract client IP from request headers (handles proxies).
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    // Take the first IP (client IP) and strip port
    return forwarded.split(',')[0].trim().split(':')[0];
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

// ── Security Headers ────────────────────────────────────────────────────────

/**
 * Return standard security headers object for API responses.
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
}
