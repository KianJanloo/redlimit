# Contributing to redlimit

Thanks for considering a contribution! Here's how to get started.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/KianJanloo/redlimit.git
cd redlimit

# Install dependencies
npm install

# Run tests
npm test

# Type check
npm run typecheck

# Build
npm run build
```

## Project Structure

```
src/
  index.ts                      # Public API barrel export + factory
  algorithms/                   # In-memory rate-limiting strategies
    types.ts                    # Core interfaces (RateLimiter, RateLimitResult)
    fixed-window.ts             # Fixed-window algorithm
    sliding-window.ts           # Sliding-window-log algorithm
  redis/                        # Redis-backed implementations
    scripts.ts                  # Lua scripts for atomic operations
    fixed-window-redis.ts       # Redis fixed-window
    sliding-window-redis.ts     # Redis sliding-window-log
  adapters/                     # Framework integrations
    express.ts                  # Express middleware
    nestjs.ts                   # NestJS guard
test/
  fixed-window.test.ts          # Unit tests for fixed-window
  sliding-window.test.ts        # Unit tests for sliding-window
  express.test.ts               # Tests for Express adapter
  nestjs.test.ts                # Tests for NestJS adapter
  factory.test.ts               # Tests for createRateLimiter
  redis/                        # Integration tests (require Docker)
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm test` | Run unit tests |
| `npm run test:redis` | Run Redis integration tests (needs Docker) |
| `npm run test -- --coverage` | Run tests with coverage report |
| `npm run build` | Build to `dist/` |
| `npm run typecheck` | Type-check without emitting |
| `npm run docs` | Generate API docs with TypeDoc |

## Testing

- Unit tests use Vitest with fake timers (`vi.useFakeTimers()`)
- Coverage threshold is 90% (statements, branches, functions, lines)
- Redis integration tests use [testcontainers](https://github.com/testcontainers/testcontainers-node) and skip automatically if Docker is unavailable

## Adding a New Algorithm

1. Create `src/algorithms/<name>.ts` implementing the `RateLimiter` interface
2. Add a `type` option for the new strategy in `src/index.ts`
3. Write tests in `test/<name>.test.ts`
4. Export from `src/index.ts`

## Adding a New Adapter

1. Create `src/adapters/<framework>.ts`
2. Export the adapter function and its options type from `src/index.ts`
3. Write tests in `test/<framework>.test.ts`

## Code Style

- TypeScript strict mode
- ESM only (`"type": "module"`)
- No external runtime dependencies beyond `ioredis` (peer deps for frameworks)
- Keep adapter code thin — logic belongs in the algorithm layer
- JSDoc on all public exports

## Pull Requests

1. Fork the repo and create a branch from `main`
2. Add tests for any new functionality
3. Ensure `npm test` and `npm run typecheck` pass
4. Keep PRs focused — one feature or fix per PR
5. Update README if adding public API

## Reporting Issues

Open a GitHub issue with:
- What you expected
- What actually happened
- Minimal reproduction (ideally a failing test)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
