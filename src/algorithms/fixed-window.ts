import type { RateLimiter, RateLimitResult } from "./types.js";

/**
 * Fixed-window rate limiter.
 *
 * Divides time into discrete windows of `windowMs` milliseconds.
 * Each key gets a counter that resets at every window boundary.
 * Simple and memory-efficient, but allows up to 2x burst at window edges.
 */
interface WindowEntry {
  count: number;
  /** Timestamp of the current window's start (aligned to windowMs). */
  windowStart: number;
}

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

  constructor(opts: FixedWindowOptions) {
    this.windowMs = opts.windowMs;
    this.max = opts.max;
  }

  /** Snap a timestamp to the start of its fixed window. */
  private getWindowStart(now: number): number {
    return Math.floor(now / this.windowMs) * this.windowMs;
  }

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

  reset(key: string): void {
    this.store.delete(key);
  }
}
