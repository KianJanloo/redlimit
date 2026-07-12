/**
 * Lua scripts for atomic Redis rate-limiting operations.
 *
 * Each script is designed to run as a single atomic EVAL call,
 * eliminating race conditions between concurrent requests.
 */

/**
 * Fixed-window: increment counter and auto-expire on first request.
 *
 * KEYS[1] = "{prefix}:{key}:{windowStart}"
 * ARGV[1] = windowMs (for PEXPIRE)
 *
 * Returns: current count in the window (1-based).
 */
export const FIXED_WINDOW_CONSUME = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
return count
`;

/**
 * Sliding-window-log: prune expired entries, add current timestamp, return count.
 *
 * KEYS[1] = "{prefix}:{key}"
 * ARGV[1] = windowMs, ARGV[2] = now (ms), ARGV[3] = unique suffix
 *
 * Returns: number of entries in the window after adding the new one.
 */
export const SLIDING_WINDOW_CONSUME = `
local cutoff = tonumber(ARGV[1]) - tonumber(ARGV[2])
redis.call("ZREMRANGEBYSCORE", KEYS[1], "-inf", cutoff)
redis.call("ZADD", KEYS[1], ARGV[2], ARGV[2] .. ":" .. ARGV[3])
redis.call("PEXPIRE", KEYS[1], ARGV[1])
return redis.call("ZCARD", KEYS[1])
`;

/**
 * Sliding-window-log peek: prune expired entries, return count without adding.
 *
 * KEYS[1] = "{prefix}:{key}"
 * ARGV[1] = windowMs, ARGV[2] = now (ms)
 *
 * Returns: number of entries currently in the window.
 */
export const SLIDING_WINDOW_PEEK = `
local cutoff = tonumber(ARGV[1]) - tonumber(ARGV[2])
redis.call("ZREMRANGEBYSCORE", KEYS[1], "-inf", cutoff)
return redis.call("ZCARD", KEYS[1])
`;
