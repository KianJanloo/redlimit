import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FixedWindow } from "../src/algorithms/fixed-window.js";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("FixedWindow", () => {
  it("allows requests under limit", () => {
    const limiter = new FixedWindow({ windowMs: 1000, max: 3 });

    expect(limiter.consume("a").allowed).toBe(true);
    expect(limiter.consume("a").allowed).toBe(true);
    expect(limiter.consume("a").allowed).toBe(true);
  });

  it("blocks requests over limit", () => {
    const limiter = new FixedWindow({ windowMs: 1000, max: 2 });

    limiter.consume("a");
    limiter.consume("a");
    expect(limiter.consume("a").allowed).toBe(false);
  });

  it("resets count after window expires", () => {
    const limiter = new FixedWindow({ windowMs: 1000, max: 2 });

    limiter.consume("a");
    limiter.consume("a");
    expect(limiter.consume("a").allowed).toBe(false);

    vi.advanceTimersByTime(1001);

    expect(limiter.consume("a").allowed).toBe(true);
  });

  it("handles multiple keys independently", () => {
    const limiter = new FixedWindow({ windowMs: 1000, max: 1 });

    limiter.consume("a");
    expect(limiter.consume("a").allowed).toBe(false);
    expect(limiter.consume("b").allowed).toBe(true);
  });

  it("peek does not affect state", () => {
    const limiter = new FixedWindow({ windowMs: 1000, max: 2 });

    limiter.consume("a");
    limiter.peek("a");
    limiter.peek("a");

    const result = limiter.consume("a");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("returns correct remaining count", () => {
    const limiter = new FixedWindow({ windowMs: 1000, max: 5 });

    expect(limiter.consume("a").remaining).toBe(4);
    expect(limiter.consume("a").remaining).toBe(3);
    expect(limiter.consume("a").remaining).toBe(2);
  });

  it("returns correct resetMs", () => {
    const limiter = new FixedWindow({ windowMs: 1000, max: 10 });

    vi.setSystemTime(new Date(1000000));
    const result = limiter.consume("a");

    expect(result.resetMs).toBe(1000);
  });

  it("peek returns full budget for a fresh key with no entry", () => {
    const limiter = new FixedWindow({ windowMs: 1000, max: 5 });

    const result = limiter.peek("nonexistent");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(5);
    expect(result.resetMs).toBe(1000);
  });

  it("peek returns full budget after window expires", () => {
    const limiter = new FixedWindow({ windowMs: 1000, max: 2 });

    limiter.consume("a");
    limiter.consume("a");
    expect(limiter.peek("a").allowed).toBe(false);

    vi.advanceTimersByTime(1001);

    expect(limiter.peek("a").allowed).toBe(true);
    expect(limiter.peek("a").remaining).toBe(2);
  });

  it("reset clears key state", () => {
    const limiter = new FixedWindow({ windowMs: 1000, max: 1 });

    limiter.consume("a");
    expect(limiter.consume("a").allowed).toBe(false);

    limiter.reset("a");
    expect(limiter.consume("a").allowed).toBe(true);
  });
});
