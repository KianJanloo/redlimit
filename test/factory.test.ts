import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRateLimiter, FixedWindow, SlidingWindowLog } from "../src/index.js";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createRateLimiter", () => {
  it("creates a FixedWindow when strategy is 'fixed-window'", () => {
    const limiter = createRateLimiter({ strategy: "fixed-window", windowMs: 1000, max: 5 });
    expect(limiter).toBeInstanceOf(FixedWindow);
  });

  it("creates a SlidingWindowLog when strategy is 'sliding-window'", () => {
    const limiter = createRateLimiter({ strategy: "sliding-window", windowMs: 1000, max: 5 });
    expect(limiter).toBeInstanceOf(SlidingWindowLog);
  });

  it("defaults to SlidingWindowLog when no strategy specified", () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 5 });
    expect(limiter).toBeInstanceOf(SlidingWindowLog);
  });

  it("creates a working FixedWindow limiter", () => {
    const limiter = createRateLimiter({ strategy: "fixed-window", windowMs: 1000, max: 2 });

    expect(limiter.consume("a").allowed).toBe(true);
    expect(limiter.consume("a").allowed).toBe(true);
    expect(limiter.consume("a").allowed).toBe(false);
  });

  it("creates a working SlidingWindowLog limiter", () => {
    const limiter = createRateLimiter({ strategy: "sliding-window", windowMs: 1000, max: 2 });

    expect(limiter.consume("a").allowed).toBe(true);
    expect(limiter.consume("a").allowed).toBe(true);
    expect(limiter.consume("a").allowed).toBe(false);
  });
});
