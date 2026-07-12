import type { CanActivate, ExecutionContext } from "@nestjs/common";
import type { RateLimiter, RateLimitResult } from "../algorithms/types.js";

/** Options for the NestJS rate-limit guard. */
export interface NestJsRateLimitOptions {
  /** The rate limiter instance to use. */
  limiter: RateLimiter;
  /** Max requests per window (for the X-RateLimit-Limit header). */
  limit?: number;
  /** Function to extract the rate-limit key from the execution context. Defaults to IP. */
  keyGenerator?: (context: ExecutionContext) => string;
  /** Called when a request is rate-limited. Defaults to throwing HttpException(429). */
  onRateLimit?: (context: ExecutionContext, result: RateLimitResult) => void;
  /** Whether to include standard rate-limit headers. Default `true`. */
  headers?: boolean;
}

/**
 * NestJS guard for rate limiting.
 *
 * @example
 * ```ts
 * import { UseGuards } from "@nestjs/common";
 * import { createRateLimiter, nestJsGuard } from "redlimit";
 *
 * const limiter = createRateLimiter({ windowMs: 60_000, max: 100 });
 *
 * @Controller("api")
 * export class ApiController {
 *   @Get("data")
 *   @UseGuards(nestJsGuard({ limiter }))
 *   getData() {
 *     return { ok: true };
 *   }
 * }
 * ```
 */
export function nestJsGuard(opts: NestJsRateLimitOptions): CanActivate {
  const {
    limiter,
    limit = 100,
    keyGenerator = (ctx) => {
      const req = ctx.switchToHttp().getRequest();
      return req.ip ?? "unknown";
    },
    onRateLimit,
    headers = true,
  } = opts;

  return {
    canActivate(context: ExecutionContext): boolean {
      const key = keyGenerator(context);
      const result = limiter.consume(key);

      if (headers) {
        const response = context.switchToHttp().getResponse();
        response.setHeader("X-RateLimit-Limit", limit);
        response.setHeader("X-RateLimit-Remaining", result.remaining);
        response.setHeader("X-RateLimit-Reset", Math.ceil(result.resetMs / 1000));
      }

      if (!result.allowed) {
        if (onRateLimit) {
          onRateLimit(context, result);
        } else {
          const { HttpException } = require("@nestjs/common");
          throw new HttpException(
            {
              error: "Too Many Requests",
              retryAfter: Math.ceil(result.resetMs / 1000),
            },
            429,
          );
        }
        return false;
      }

      return true;
    },
  };
}
