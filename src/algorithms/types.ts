/** Outcome of a single rate-limit check. */
export interface RateLimitResult {
  /** Whether the request is allowed through. */
  allowed: boolean;
  /** How many more requests can be made in the current window. */
  remaining: number;
  /** Milliseconds until the current window resets and the full budget is restored. */
  resetMs: number;
}

/**
 * Common interface implemented by all rate-limiting strategies.
 *
 * Call {@link consume} to count a request and check if it's within limits.
 * Call {@link peek} to read state without side effects (useful for dashboards).
 * Call {@link reset} to clear a key's state (e.g. after a user logs out).
 */
export interface RateLimiter {
  /**
   * Record a request for the given key and check if it's allowed.
   *
   * @param key - Identifier for the rate-limit bucket (e.g. IP, user ID, API key).
   * @returns Whether the request is allowed, remaining budget, and reset time.
   */
  consume(key: string): RateLimitResult;

  /**
   * Check the current state without consuming a request.
   *
   * @param key - Identifier for the rate-limit bucket.
   * @returns Current state as if {@link consume} were called, but count is unchanged.
   */
  peek(key: string): RateLimitResult;

  /**
   * Clear all tracked state for a key.
   *
   * @param key - Identifier for the rate-limit bucket to reset.
   */
  reset(key: string): void;
}
