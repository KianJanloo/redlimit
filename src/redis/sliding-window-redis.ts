import { Redis } from "ioredis";
import { SLIDING_WINDOW_CONSUME, SLIDING_WINDOW_PEEK } from "./scripts.js";

/** Options for {@link RedisSlidingWindowLog}. */
export interface RedisSlidingWindowOptions {
  /** ioredis client instance. Caller manages the connection lifecycle. */
  redis: Redis;
  /** Key prefix to namespace rate-limit keys. Default `"rl"`. */
  prefix?: string;
  /** Duration of the sliding window in milliseconds. */
  windowMs: number;
  /** Maximum requests allowed within any window. */
  max: number;
}

/** Result of a rate-limit check. */
interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

let counter = 0;

/**
 * Redis-backed sliding-window-log rate limiter.
 *
 * Uses sorted sets (ZSET) with timestamps as scores.
 * Two Lua scripts handle atomic consume (prune + add) and peek (prune only).
 *
 * @example
 * ```ts
 * import { Redis } from "ioredis";
 * import { RedisSlidingWindowLog } from "redlimit";
 *
 * const redis = new Redis();
 * const limiter = new RedisSlidingWindowLog({ redis, windowMs: 60_000, max: 100 });
 * const result = await limiter.consume("user:123");
 * ```
 */
export class RedisSlidingWindowLog {
  private redis: Redis;
  private prefix: string;
  private windowMs: number;
  private max: number;
  private consumeSha: string | null = null;
  private peekSha: string | null = null;

  constructor(opts: RedisSlidingWindowOptions) {
    this.redis = opts.redis;
    this.prefix = opts.prefix ?? "rl";
    this.windowMs = opts.windowMs;
    this.max = opts.max;
  }

  private async loadScripts(): Promise<{ consumeSha: string; peekSha: string }> {
    if (this.consumeSha && this.peekSha) {
      return { consumeSha: this.consumeSha, peekSha: this.peekSha };
    }
    const [consumeSha, peekSha] = await Promise.all([
      this.redis.script("LOAD", SLIDING_WINDOW_CONSUME) as Promise<string>,
      this.redis.script("LOAD", SLIDING_WINDOW_PEEK) as Promise<string>,
    ]);
    this.consumeSha = consumeSha;
    this.peekSha = peekSha;
    return { consumeSha, peekSha };
  }

  private getRedisKey(key: string): string {
    return `${this.prefix}:sw:${key}`;
  }

  /**
   * Record a request and check if it's within the window limit.
   *
   * @param key - Rate-limit bucket identifier.
   * @returns Allowance status, remaining budget, and time until the oldest entry expires.
   */
  async consume(key: string): Promise<RateLimitResult> {
    const { consumeSha } = await this.loadScripts();
    const redisKey = this.getRedisKey(key);
    const now = Date.now();
    const suffix = `${now}-${++counter}`;

    const count = (await this.redis.evalsha(
      consumeSha, 1, redisKey,
      this.windowMs, now, suffix,
    )) as number;

    return {
      allowed: count <= this.max,
      remaining: Math.max(0, this.max - count),
      resetMs: this.windowMs, // conservative: full window from now
    };
  }

  /**
   * Check current state without consuming a request.
   * Prunes expired entries and returns the current count.
   *
   * @param key - Rate-limit bucket identifier.
   * @returns Current state with count unchanged.
   */
  async peek(key: string): Promise<RateLimitResult> {
    const { peekSha } = await this.loadScripts();
    const redisKey = this.getRedisKey(key);
    const now = Date.now();

    const count = (await this.redis.evalsha(
      peekSha, 1, redisKey,
      this.windowMs, now,
    )) as number;

    return {
      allowed: count < this.max,
      remaining: Math.max(0, this.max - count),
      resetMs: this.windowMs,
    };
  }

  /**
   * Clear all tracked state for a key.
   *
   * @param key - Rate-limit bucket identifier.
   */
  async reset(key: string): Promise<void> {
    const redisKey = this.getRedisKey(key);
    await this.redis.del(redisKey);
  }
}
