import type { RateLimiter, RateLimitResult } from "./types.js";

/**
 * Sliding-window-log rate limiter.
 *
 * Stores the exact timestamp of every request within the window.
 * Prunes expired entries on each call, then checks if count < max.
 *
 * - **Pros**: accurate — no edge-burst problem like fixed-window
 * - **Cons**: O(n) memory per key where n = requests in the window
 *
 * @example
 * ```ts
 * const limiter = new SlidingWindowLog({ windowMs: 60_000, max: 10 });
 * limiter.consume("ip:1.2.3.4"); // { allowed: true, remaining: 9, ... }
 * ```
 */
/** Options for {@link SlidingWindowLog}. */
export interface SlidingWindowOptions {
  /** Duration of the sliding window in milliseconds. */
  windowMs: number;
  /** Maximum requests allowed within any window. */
  max: number;
}

export class SlidingWindowLog implements RateLimiter {
  /** Per-key array of request timestamps, kept sorted ascending. */
  private store = new Map<string, number[]>();
  private windowMs: number;
  private max: number;

  /**
   * @param opts - Window duration and max request count.
   */
  constructor(opts: SlidingWindowOptions) {
    this.windowMs = opts.windowMs;
    this.max = opts.max;
  }

  /**
   * Remove timestamps older than `windowMs` from the front of the array.
   * Assumes timestamps are sorted ascending — stops at the first non-expired entry.
   */
  private prune(timestamps: number[], now: number): number[] {
    const cutoff = now - this.windowMs;
    let i = 0;
    while (i < timestamps.length && timestamps[i] <= cutoff) i++;
    return timestamps.slice(i);
  }

  /**
   * Record a request and check if it's within the window limit.
   *
   * @param key - Rate-limit bucket identifier.
   * @returns Allowance status, remaining budget, and time until the oldest entry expires.
   */
  consume(key: string): RateLimitResult {
    const now = Date.now();
    const timestamps = this.prune(this.store.get(key) ?? [], now);
    timestamps.push(now);
    this.store.set(key, timestamps);

    return {
      allowed: timestamps.length <= this.max,
      remaining: Math.max(0, this.max - timestamps.length),
      // Time until the oldest entry in the window expires
      resetMs: timestamps.length > 0 ? timestamps[0] + this.windowMs - now : this.windowMs,
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
    const timestamps = this.prune(this.store.get(key) ?? [], now);

    return {
      allowed: timestamps.length < this.max,
      remaining: Math.max(0, this.max - timestamps.length),
      resetMs: timestamps.length > 0 ? timestamps[0] + this.windowMs - now : this.windowMs,
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
