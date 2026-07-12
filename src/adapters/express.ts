import type { Request, Response, NextFunction } from "express";
import type { RateLimiter, RateLimitResult } from "../algorithms/types.js";

/** Options for the Express rate-limit middleware. */
export interface ExpressRateLimitOptions {
  /** The rate limiter instance to use. */
  limiter: RateLimiter;
  /** Max requests per window (for the X-RateLimit-Limit header). */
  limit?: number;
  /** Function to extract the rate-limit key from a request. Defaults to `req.ip`. */
  keyGenerator?: (req: Request) => string;
  /** Called when a request is rate-limited. Defaults to sending a 429 JSON response. */
  onRateLimit?: (req: Request, res: Response, result: RateLimitResult) => void;
  /** Whether to include standard rate-limit headers. Default `true`. */
  headers?: boolean;
}

/**
 * Express middleware for rate limiting.
 *
 * @example
 * ```ts
 * import express from "express";
 * import { createRateLimiter, expressMiddleware } from "redlimit";
 *
 * const limiter = createRateLimiter({ windowMs: 60_000, max: 100 });
 * const app = express();
 * app.use(expressMiddleware({ limiter }));
 * ```
 */
export function expressMiddleware(opts: ExpressRateLimitOptions) {
  const {
    limiter,
    limit = 100,
    keyGenerator = (req) => req.ip ?? "unknown",
    onRateLimit,
    headers = true,
  } = opts;

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    const result = limiter.consume(key);

    if (headers) {
      res.setHeader("X-RateLimit-Limit", limit);
      res.setHeader("X-RateLimit-Remaining", result.remaining);
      res.setHeader("X-RateLimit-Reset", Math.ceil(result.resetMs / 1000));
    }

    if (!result.allowed) {
      if (onRateLimit) {
        onRateLimit(req, res, result);
      } else {
        res.status(429).json({
          error: "Too Many Requests",
          retryAfter: Math.ceil(result.resetMs / 1000),
        });
      }
      return;
    }

    next();
  };
}
