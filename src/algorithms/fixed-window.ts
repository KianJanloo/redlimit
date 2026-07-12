import type { RateLimiter, RateLimitResult } from "./types.js";

/**
 * Fixed-window rate limiter.
 *
 * Divides time into discrete windows of `windowMs` milliseconds.
 * Each key gets a counter that resets at every window boundary.
 *
 * - **Pros**: simple, O(1) memory per key
 * - **Cons**: allows up to 2x burst at window edges
 *
 * @example
 * ```ts
 * const limiter = new FixedWindow({ windowMs: 60_000, max: 10 });
 * limiter.consume("ip:1.2.3.4"); // { allowed: true, remaining: 9, ... }
 * ```
 */
interface WindowEntry {
  /** Number of requests in the current window. */
  count: number;
  /** Timestamp of the current window's start (aligned to `windowMs`). */
  windowStart: number;
}

/** Options for {@link FixedWindow}. */
export interface FixedWindowOptions {
  /** Duration of each window in milliseconds. */
  windowMs: number;
  /** Maximum requests allowed per window. */
  max: number;
}

export class FixedWindow implements RateLimiter {
  private store = new Map<string, WindowEntry>();
  private windowMs: number;
  private max: number;

  /**
   * @param opts - Window duration and max request count.
   */
  constructor(opts: FixedWindowOptions) {
    this.windowMs = opts.windowMs;
    this.max = opts.max;
  }

  /**
   * Snap a timestamp to the start of its fixed window.
   * e.g. `Math.floor(1500 / 1000) * 1000 = 1000`
   */
  private getWindowStart(now: number): number {
    return Math.floor(now / this.windowMs) * this.windowMs;
  }

  /**
   * Record a request and check if it's within the window limit.
   *
   * @param key - Rate-limit bucket identifier.
   * @returns Allowance status, remaining budget, and time until reset.
   */
  consume(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = this.getWindowStart(now);
    let entry = this.store.get(key);

    // Reset counter if we've moved into a new window
    if (!entry || entry.windowStart !== windowStart) {
      entry = { count: 0, windowStart };
    }

    entry.count++;
    this.store.set(key, entry);

    return {
      allowed: entry.count <= this.max,
      remaining: Math.max(0, this.max - entry.count),
      resetMs: windowStart + this.windowMs - now,
    };
  }

  /**
   * Check current state without consuming a request.
   *
   * @param key - Rate-limit bucket identifier.
   * @returns Current state with count unchanged.
   */
  peek(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = this.getWindowStart(now);
    const entry = this.store.get(key);

    // No entry or stale window = full budget available
    if (!entry || entry.windowStart !== windowStart) {
      return { allowed: true, remaining: this.max, resetMs: this.windowMs };
    }

    return {
      allowed: entry.count < this.max,
      remaining: Math.max(0, this.max - entry.count),
      resetMs: windowStart + this.windowMs - now,
    };
  }

  /**
   * Clear all tracked state for a key.
   *
   * @param key - Rate-limit bucket identifier.
   */
  reset(key: string): void {
    this.store.delete(key);
  }
}
