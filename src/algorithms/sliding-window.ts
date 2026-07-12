import type { RateLimiter, RateLimitResult } from "./types.js";

/**
 * Sliding-window-log rate limiter.
 *
 * Stores the exact timestamp of every request within the window.
 * Prunes expired entries on each call, then checks if count < max.
 * More accurate than fixed-window (no edge burst), but uses O(n) memory per key
 * where n = requests in the window.
 */
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

  constructor(opts: SlidingWindowOptions) {
    this.windowMs = opts.windowMs;
    this.max = opts.max;
  }

  /** Remove timestamps older than `windowMs` from the front of the array. */
  private prune(timestamps: number[], now: number): number[] {
    const cutoff = now - this.windowMs;
    let i = 0;
    while (i < timestamps.length && timestamps[i] <= cutoff) i++;
    return timestamps.slice(i);
  }

  consume(key: string): RateLimitResult {
    const now = Date.now();
    const timestamps = this.prune(this.store.get(key) ?? [], now);
    timestamps.push(now);
    this.store.set(key, timestamps);

    return {
      allowed: timestamps.length <= this.max,
      remaining: Math.max(0, this.max - timestamps.length),
      // resetMs = time until the oldest entry in the window expires
      resetMs: timestamps.length > 0 ? timestamps[0] + this.windowMs - now : this.windowMs,
    };
  }

  peek(key: string): RateLimitResult {
    const now = Date.now();
    const timestamps = this.prune(this.store.get(key) ?? [], now);

    return {
      allowed: timestamps.length < this.max,
      remaining: Math.max(0, this.max - timestamps.length),
      resetMs: timestamps.length > 0 ? timestamps[0] + this.windowMs - now : this.windowMs,
    };
  }

  reset(key: string): void {
    this.store.delete(key);
  }
}
