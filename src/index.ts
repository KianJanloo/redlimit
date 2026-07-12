export type { RateLimiter, RateLimitResult } from "./algorithms/types.js";
export { FixedWindow, type FixedWindowOptions } from "./algorithms/fixed-window.js";
export { SlidingWindowLog, type SlidingWindowOptions } from "./algorithms/sliding-window.js";

import type { RateLimiter } from "./algorithms/types.js";
import { FixedWindow, type FixedWindowOptions } from "./algorithms/fixed-window.js";
import { SlidingWindowLog, type SlidingWindowOptions } from "./algorithms/sliding-window.js";

export type Strategy = "fixed-window" | "sliding-window";

export interface CreateRateLimiterOptions {
  strategy?: Strategy;
  windowMs: number;
  max: number;
}

/** Factory that picks a strategy and returns a ready-to-use RateLimiter. */
export function createRateLimiter(opts: CreateRateLimiterOptions): RateLimiter {
  switch (opts.strategy) {
    case "fixed-window":
      return new FixedWindow(opts);
    case "sliding-window":
    default:
      return new SlidingWindowLog(opts);
  }
}
