import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FixedWindow } from "../src/algorithms/fixed-window.js";
import { nestJsGuard } from "../src/adapters/nestjs.js";
import type { ExecutionContext } from "@nestjs/common";

function mockContext(overrides: Record<string, unknown> = {}): ExecutionContext {
  const headers: Record<string, string | number> = {};
  const res = {
    headers,
    setHeader(name: string, value: string | number) {
      headers[name] = value;
    },
  };
  const req = { ip: "127.0.0.1", ...overrides };

  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe("nestJsGuard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true when request is allowed", () => {
    const limiter = new FixedWindow({ windowMs: 1000, max: 5 });
    const guard = nestJsGuard({ limiter });

    expect(guard.canActivate(mockContext())).toBe(true);
  });

  it("returns false when rate limit exceeded (default throws)", () => {
    const limiter = new FixedWindow({ windowMs: 1000, max: 1 });
    const guard = nestJsGuard({ limiter });

    expect(guard.canActivate(mockContext())).toBe(true);
    expect(() => guard.canActivate(mockContext())).toThrow();
  });

  it("sets rate-limit headers by default", () => {
    const limiter = new FixedWindow({ windowMs: 1000, max: 10 });
    const guard = nestJsGuard({ limiter });

    const ctx = mockContext();
    guard.canActivate(ctx);

    const res = ctx.switchToHttp().getResponse() as any;
    expect(res.headers["X-RateLimit-Limit"]).toBe(100);
    expect(res.headers["X-RateLimit-Remaining"]).toBe(9);
  });

  it("omits headers when headers: false", () => {
    const limiter = new FixedWindow({ windowMs: 1000, max: 10 });
    const guard = nestJsGuard({ limiter, headers: false });

    const ctx = mockContext();
    guard.canActivate(ctx);

    const res = ctx.switchToHttp().getResponse() as any;
    expect(res.headers["X-RateLimit-Limit"]).toBeUndefined();
  });

  it("uses custom keyGenerator", () => {
    const limiter = new FixedWindow({ windowMs: 1000, max: 5 });
    const keyGenerator = vi.fn((ctx: ExecutionContext) => {
      const req = ctx.switchToHttp().getRequest();
      return req.headers?.["x-api-key"] ?? "default";
    });
    const guard = nestJsGuard({ limiter, keyGenerator });

    guard.canActivate(mockContext({ headers: { "x-api-key": "test-key" } }));

    expect(keyGenerator).toHaveBeenCalledOnce();
  });

  it("uses custom onRateLimit handler instead of throwing", () => {
    const limiter = new FixedWindow({ windowMs: 1000, max: 1 });
    const onRateLimit = vi.fn();
    const guard = nestJsGuard({ limiter, onRateLimit });

    guard.canActivate(mockContext()); // consume
    const result = guard.canActivate(mockContext()); // blocked

    expect(onRateLimit).toHaveBeenCalledOnce();
    expect(result).toBe(false);
  });

  it("falls back to 'unknown' key when req.ip is undefined", () => {
    const limiter = new FixedWindow({ windowMs: 1000, max: 5 });
    const guard = nestJsGuard({ limiter });

    expect(guard.canActivate(mockContext({ ip: undefined }))).toBe(true);
  });
});
