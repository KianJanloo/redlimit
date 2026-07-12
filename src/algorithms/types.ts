/** Outcome of a rate-limit check. */
export interface RateLimitResult {
  /** Whether the request is allowed. */
  allowed: boolean;
  /** How many requests remain in the current window. */
  remaining: number;
  /** Milliseconds until the current window resets. */
  resetMs: number;
}

/** Common interface for all rate-limiting strategies. */
export interface RateLimiter {
  /** Consume one request from the bucket. Returns whether it's allowed. */
  consume(key: string): RateLimitResult;
  /** Check current state without mutating (observability, dashboards). */
  peek(key: string): RateLimitResult;
  /** Clear all tracked state for a key. */
  reset(key: string): void;
}
