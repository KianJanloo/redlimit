# redlimit

[![npm version](https://img.shields.io/npm/v/redlimit.svg)](https://www.npmjs.com/package/redlimit)
[![CI](https://github.com/KianJanloo/redlimit/actions/workflows/ci.yml/badge.svg)](https://github.com/KianJanloo/redlimit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen.svg)](#testing)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)

Rate-limiting middleware for Express and NestJS, backed by Redis or in-memory storage. Implements fixed-window and sliding-window-log algorithms with atomic Lua scripts for distributed environments.

## Install

```bash
npm install redlimit
```

Peer dependencies (install only what you use):

```bash
npm install express        # if using Express
npm install @nestjs/common  # if using NestJS
npm install ioredis         # if using Redis-backed limiters
```

## Quick Start

### Express

```ts
import express from "express";
import { createRateLimiter, expressMiddleware } from "redlimit";

const limiter = createRateLimiter({ windowMs: 60_000, max: 100 });
const app = express();

app.use(expressMiddleware({ limiter }));

app.get("/api/data", (req, res) => {
  res.json({ ok: true });
});
```

### NestJS

```ts
import { Controller, Get, UseGuards } from "@nestjs/common";
import { createRateLimiter, nestJsGuard } from "redlimit";

const limiter = createRateLimiter({ windowMs: 60_000, max: 100 });

@Controller("api")
export class ApiController {
  @Get("data")
  @UseGuards(nestJsGuard({ limiter }))
  getData() {
    return { ok: true };
  }
}
```

### Redis (Distributed)

```ts
import { Redis } from "ioredis";
import { RedisFixedWindow, RedisSlidingWindowLog } from "redlimit";

const redis = new Redis();

const limiter = new RedisFixedWindow({
  redis,
  windowMs: 60_000,
  max: 100,
  prefix: "my-app", // optional, defaults to "rl"
});
```

## Algorithms

| Algorithm | Storage | Sync/Async | Trade-off |
|-----------|---------|------------|-----------|
| **Fixed Window** | In-memory `Map` | Sync | Simple, O(1) memory. Allows 2x burst at window edges. |
| **Sliding Window Log** | In-memory `Map` of timestamps | Sync | Accurate, no edge burst. O(n) memory per key. |
| **Redis Fixed Window** | Redis (INCR + PEXPIRE) | Async | Distributed, atomic. Same edge-burst caveat. |
| **Redis Sliding Window Log** | Redis (ZSET + Lua) | Async | Distributed, accurate. ZSET-based pruning. |

## API

### Factory

```ts
createRateLimiter(opts: CreateRateLimiterOptions): RateLimiter
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `strategy` | `"fixed-window" \| "sliding-window"` | `"sliding-window"` | Algorithm to use |
| `windowMs` | `number` | — | Duration of the rate-limit window (ms) |
| `max` | `number` | — | Maximum requests per window |

### Classes

#### `FixedWindow`

```ts
new FixedWindow(opts: FixedWindowOptions)
```

In-memory fixed-window limiter. Synchronous API.

| Method | Returns | Description |
|--------|---------|-------------|
| `consume(key)` | `RateLimitResult` | Record a request and check if allowed |
| `peek(key)` | `RateLimitResult` | Check state without consuming |
| `reset(key)` | `void` | Clear a key's state |

#### `SlidingWindowLog`

```ts
new SlidingWindowLog(opts: SlidingWindowOptions)
```

In-memory sliding-window-log limiter. Synchronous API. Same methods as `FixedWindow`.

#### `RedisFixedWindow`

```ts
new RedisFixedWindow(opts: RedisFixedWindowOptions)
```

Redis-backed fixed-window limiter. Async API (`Promise`-based).

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `redis` | `Redis` | — | ioredis client instance |
| `prefix` | `string` | `"rl"` | Key namespace prefix |
| `windowMs` | `number` | — | Window duration (ms) |
| `max` | `number` | — | Max requests per window |

| Method | Returns | Description |
|--------|---------|-------------|
| `consume(key)` | `Promise<RateLimitResult>` | Record and check |
| `peek(key)` | `Promise<RateLimitResult>` | Check without consuming |
| `reset(key)` | `Promise<void>` | Clear key state |

#### `RedisSlidingWindowLog`

```ts
new RedisSlidingWindowLog(opts: RedisSlidingWindowOptions)
```

Redis-backed sliding-window-log limiter using sorted sets. Same interface as `RedisFixedWindow`.

### Adapters

#### Express Middleware

```ts
expressMiddleware(opts: ExpressRateLimitOptions): (req, res, next) => void
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `limiter` | `RateLimiter` | — | Rate limiter instance |
| `limit` | `number` | `100` | Max requests (for `X-RateLimit-Limit` header) |
| `keyGenerator` | `(req) => string` | `req.ip` | Extract rate-limit key from request |
| `onRateLimit` | `(req, res, result) => void` | Send 429 JSON | Custom handler when blocked |
| `headers` | `boolean` | `true` | Include `X-RateLimit-*` headers |

#### NestJS Guard

```ts
nestJsGuard(opts: NestJsRateLimitOptions): CanActivate
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `limiter` | `RateLimiter` | — | Rate limiter instance |
| `limit` | `number` | `100` | Max requests (for header) |
| `keyGenerator` | `(ctx) => string` | IP from request | Extract key from context |
| `onRateLimit` | `(ctx, result) => void` | Throw `HttpException(429)` | Custom handler |
| `headers` | `boolean` | `true` | Include headers |

### Types

```ts
interface RateLimitResult {
  allowed: boolean;    // Whether the request passed
  remaining: number;   // Requests left in the window
  resetMs: number;     // Ms until the window resets
}

type Strategy = "fixed-window" | "sliding-window";
```

## Configuration Examples

### Custom Key Generator

```ts
// Rate limit by API key instead of IP
expressMiddleware({
  limiter,
  keyGenerator: (req) => req.headers["x-api-key"] as string,
});
```

### Custom Rate Limit Response

```ts
expressMiddleware({
  limiter,
  onRateLimit: (req, res, result) => {
    res.status(429).json({
      error: "Rate limit exceeded",
      retryAfter: Math.ceil(result.resetMs / 1000),
    });
  },
});
```

### Per-Route Limits

```ts
const globalLimiter = createRateLimiter({ windowMs: 60_000, max: 1000 });
const strictLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });

app.use(expressMiddleware({ limiter: globalLimiter }));
app.use("/api/sensitive", expressMiddleware({ limiter: strictLimiter }));
```

## Headers

When enabled (default), responses include standard rate-limit headers:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Max requests allowed |
| `X-RateLimit-Remaining` | Requests remaining in window |
| `X-RateLimit-Reset` | Seconds until the window resets |

## API Documentation

Generate API docs with TypeDoc:

```bash
npm run docs
```

Output will be in `docs/`.

## Testing

```bash
npm test              # Unit tests (in-memory algorithms + adapters)
npm run test:redis    # Integration tests (requires Docker)
```

Coverage thresholds are enforced at 90% for statements, branches, functions, and lines.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

[MIT](LICENSE)
