import { Redis } from "ioredis";
import { FIXED_WINDOW_CONSUME } from "./scripts.js";

/** Options for {@link RedisFixedWindow}. */
export interface RedisFixedWindowOptions {
  /** ioredis client instance. Caller manages the connection lifecycle. */
  redis: Redis;
  /** Key prefix to namespace rate-limit keys. Default `"rl"`. */
  prefix?: string;
  /** Duration of each window in milliseconds. */
  windowMs: number;
  /** Maximum requests allowed per window. */
  max: number;
}

/** Result of a rate-limit check. */
interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

/**
 * Redis-backed fixed-window rate limiter.
 *
 * Uses a single Lua script (INCR + PEXPIRE) for atomic operation.
 * Each window is a separate Redis key that auto-expires.
 *
 * @example
 * ```ts
 * import { Redis } from "ioredis";
 * import { RedisFixedWindow } from "redlimit";
 *
 * const redis = new Redis();
 * const limiter = new RedisFixedWindow({ redis, windowMs: 60_000, max: 100 });
 * const result = await limiter.consume("user:123");
 * ```
 */
export class RedisFixedWindow {
  private redis: Redis;
  private prefix: string;
  private windowMs: number;
  private max: number;
  private scriptSha: string | null = null;

  constructor(opts: RedisFixedWindowOptions) {
    this.redis = opts.redis;
    this.prefix = opts.prefix ?? "rl";
    this.windowMs = opts.windowMs;
    this.max = opts.max;
  }

  /** Load the Lua script into Redis and cache the SHA. */
  private async loadScript(): Promise<string> {
    if (this.scriptSha) return this.scriptSha;
    this.scriptSha = (await this.redis.script("LOAD", FIXED_WINDOW_CONSUME)) as string;
    return this.scriptSha;
  }

  private getKey(key: string): string {
    const windowStart = Math.floor(Date.now() / this.windowMs) * this.windowMs;
    return `${this.prefix}:fw:${key}:${windowStart}`;
  }

  /**
   * Record a request and check if it's within the window limit.
   *
   * @param key - Rate-limit bucket identifier.
   * @returns Allowance status, remaining budget, and time until reset.
   */
  async consume(key: string): Promise<RateLimitResult> {
    const sha = await this.loadScript();
    const redisKey = this.getKey(key);
    const count = (await this.redis.evalsha(sha, 1, redisKey, this.windowMs)) as number;

    const now = Date.now();
    const windowStart = Math.floor(now / this.windowMs) * this.windowMs;

    return {
      allowed: count <= this.max,
      remaining: Math.max(0, this.max - count),
      resetMs: windowStart + this.windowMs - now,
    };
  }

  /**
   * Check current state without consuming a request.
   * Reads the counter and TTL to compute state.
   *
   * @param key - Rate-limit bucket identifier.
   * @returns Current state with count unchanged.
   */
  async peek(key: string): Promise<RateLimitResult> {
    const redisKey = this.getKey(key);
    const count = parseInt((await this.redis.get(redisKey)) ?? "0", 10);
    const ttl = await this.redis.pttl(redisKey);

    return {
      allowed: count < this.max,
      remaining: Math.max(0, this.max - count),
      resetMs: ttl > 0 ? ttl : this.windowMs,
    };
  }

  /**
   * Clear all tracked state for a key.
   *
   * @param key - Rate-limit bucket identifier.
   */
  async reset(key: string): Promise<void> {
    const windowStart = Math.floor(Date.now() / this.windowMs) * this.windowMs;
    const redisKey = `${this.prefix}:fw:${key}:${windowStart}`;
    await this.redis.del(redisKey);
  }
}
