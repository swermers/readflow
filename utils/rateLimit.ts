/**
 * Simple in-memory sliding-window rate limiter.
 * Suitable for single-instance deployments (Vercel serverless with low concurrency).
 * For multi-instance deployments, replace with Redis-backed limiter (e.g. Upstash).
 */

type RateLimitEntry = {
  timestamps: number[];
};

const store = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  const cutoff = now - windowMs;
  store.forEach((entry, key) => {
    entry.timestamps = entry.timestamps.filter((t: number) => t > cutoff);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  });
}

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetMs: number;
};

/**
 * Check if a request is allowed under the rate limit.
 *
 * @param key - Unique identifier (e.g., `${userId}:${endpoint}`)
 * @param maxRequests - Maximum requests allowed in the window
 * @param windowMs - Time window in milliseconds
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;

  cleanup(windowMs);

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove expired timestamps
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= maxRequests) {
    const oldestInWindow = entry.timestamps[0];
    return {
      allowed: false,
      remaining: 0,
      resetMs: oldestInWindow + windowMs - now,
    };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: maxRequests - entry.timestamps.length,
    resetMs: windowMs,
  };
}

/**
 * Create a rate-limit response with standard headers.
 */
export function rateLimitResponse(resetMs: number) {
  return new Response(
    JSON.stringify({ error: 'Too many requests. Please try again later.' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.ceil(resetMs / 1000)),
      },
    },
  );
}
