export type { RateLimiter, RateLimitResult } from "./algorithms/types.js";
export { FixedWindow, type FixedWindowOptions } from "./algorithms/fixed-window.js";
export { SlidingWindowLog, type SlidingWindowOptions } from "./algorithms/sliding-window.js";
export { RedisFixedWindow, type RedisFixedWindowOptions } from "./redis/fixed-window-redis.js";
export { RedisSlidingWindowLog, type RedisSlidingWindowOptions } from "./redis/sliding-window-redis.js";

import type { RateLimiter } from "./algorithms/types.js";
import { FixedWindow, type FixedWindowOptions } from "./algorithms/fixed-window.js";
import { SlidingWindowLog, type SlidingWindowOptions } from "./algorithms/sliding-window.js";

/** Available rate-limiting strategies. */
export type Strategy = "fixed-window" | "sliding-window";

/** Options for the {@link createRateLimiter} factory. */
export interface CreateRateLimiterOptions {
  /** Strategy to use. Defaults to `"sliding-window"`. */
  strategy?: Strategy;
  /** Duration of the rate-limit window in milliseconds. */
  windowMs: number;
  /** Maximum requests allowed per window. */
  max: number;
}

/**
 * Create a rate limiter instance.
 *
 * @example
 * ```ts
 * const limiter = createRateLimiter({ strategy: "sliding-window", windowMs: 60_000, max: 100 });
 * const result = limiter.consume("user:123");
 * ```
 *
 * @param opts - Configuration for the rate limiter.
 * @returns A {@link RateLimiter} instance ready to consume requests.
 */
export function createRateLimiter(opts: CreateRateLimiterOptions): RateLimiter {
  switch (opts.strategy) {
    case "fixed-window":
      return new FixedWindow(opts);
    case "sliding-window":
    default:
      return new SlidingWindowLog(opts);
  }
}
