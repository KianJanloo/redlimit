import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FixedWindow } from "../src/algorithms/fixed-window.js";
import { expressMiddleware } from "../src/adapters/express.js";
import type { Request, Response, NextFunction } from "express";

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    ip: "127.0.0.1",
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response {
  const headers: Record<string, string | number> = {};
  const res = {
    headers,
    statusCode: 0,
    body: null as unknown,
    setHeader(name: string, value: string | number) {
      headers[name] = value;
      return res;
    },
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
      return res;
    },
  } as unknown as Response;
  return res;
}

describe("expressMiddleware", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls next() when request is allowed", () => {
    const limiter = new FixedWindow({ windowMs: 1000, max: 5 });
    const middleware = expressMiddleware({ limiter });
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(0);
  });

  it("sends 429 when rate limit exceeded", () => {
    const limiter = new FixedWindow({ windowMs: 1000, max: 1 });
    const middleware = expressMiddleware({ limiter });
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next); // allowed
    middleware(req, res, next); // blocked

    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(429);
    expect((res.body as Record<string, unknown>).error).toBe("Too Many Requests");
  });

  it("sets rate-limit headers by default", () => {
    const limiter = new FixedWindow({ windowMs: 1000, max: 10 });
    const middleware = expressMiddleware({ limiter, limit: 10 });
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.headers["X-RateLimit-Limit"]).toBe(10);
    expect(res.headers["X-RateLimit-Remaining"]).toBe(9);
    expect(typeof res.headers["X-RateLimit-Reset"]).toBe("number");
  });

  it("omits headers when headers: false", () => {
    const limiter = new FixedWindow({ windowMs: 1000, max: 10 });
    const middleware = expressMiddleware({ limiter, headers: false });
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.headers["X-RateLimit-Limit"]).toBeUndefined();
    expect(res.headers["X-RateLimit-Remaining"]).toBeUndefined();
  });

  it("uses custom keyGenerator", () => {
    const limiter = new FixedWindow({ windowMs: 1000, max: 1 });
    const keyGenerator = vi.fn((req: Request) => (req as any).headers["x-api-key"] as string);
    const middleware = expressMiddleware({ limiter, keyGenerator });
    const req = mockReq({ headers: { "x-api-key": "key-abc" } } as any);
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(keyGenerator).toHaveBeenCalledWith(req);
    expect(next).toHaveBeenCalledOnce();
  });

  it("uses custom onRateLimit handler", () => {
    const limiter = new FixedWindow({ windowMs: 1000, max: 1 });
    const onRateLimit = vi.fn();
    const middleware = expressMiddleware({ limiter, onRateLimit });
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next); // allowed
    middleware(req, res, next); // blocked

    expect(onRateLimit).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(0); // custom handler, not default 429
  });

  it("uses default limit of 100 for headers", () => {
    const limiter = new FixedWindow({ windowMs: 1000, max: 5 });
    const middleware = expressMiddleware({ limiter });
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.headers["X-RateLimit-Limit"]).toBe(100);
  });

  it("falls back to 'unknown' key when req.ip is undefined", () => {
    const limiter = new FixedWindow({ windowMs: 1000, max: 5 });
    const middleware = expressMiddleware({ limiter });
    const req = mockReq({ ip: undefined });
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("includes retryAfter in 429 response", () => {
    const limiter = new FixedWindow({ windowMs: 1000, max: 1 });
    const middleware = expressMiddleware({ limiter });
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next); // consume
    middleware(req, res, next); // block

    expect((res.body as Record<string, unknown>).retryAfter).toBeDefined();
    expect(typeof (res.body as Record<string, unknown>).retryAfter).toBe("number");
  });
});
