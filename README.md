Node.js/TypeScript rate-limiting middleware implementing sliding-window and token-bucket algorithms, backed by Redis, for Express and NestJS.

Goals
- Publish a real npm package with semantic versioning, docs, and tests — not just a repo.
- Learn distributed rate-limiting algorithms and their tradeoffs (fixed window, sliding window, token bucket).
- Design a clean, minimal public API that other developers will actually adopt.
- Build credibility with a concrete artifact: downloads, GitHub stars, real usage.

Tech Stack
- Core: TypeScript, Node.js
- Storage: Redis (ioredis), Lua scripts for atomic operations
- Adapters: Express middleware + NestJS guard/interceptor
- Testing: Jest, integration tests against real Redis (Testcontainers or Docker Compose)
- Tooling: tsup/esbuild bundling, GitHub Actions CI, Changesets for versioning and publishing

Architecture
- Core module: pluggable strategies (fixed-window, sliding-window-log, sliding-window-counter, token-bucket).
- Redis layer: atomic INCR/EXPIRE or Lua scripts to avoid race conditions under concurrent load.
- Framework adapters: thin wrappers exposing the core limiter as Express middleware and NestJS guard.
- Config API: per-route limits, custom key generators (IP, user ID, API key), custom response handlers.
- Fallback: in-memory store for local dev and testing without Redis.
