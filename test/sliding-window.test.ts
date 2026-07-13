import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SlidingWindowLog } from "../src/algorithms/sliding-window.js";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("SlidingWindowLog", () => {
  it("allows requests under limit", () => {
    const limiter = new SlidingWindowLog({ windowMs: 1000, max: 3 });

    expect(limiter.consume("a").allowed).toBe(true);
    expect(limiter.consume("a").allowed).toBe(true);
    expect(limiter.consume("a").allowed).toBe(true);
  });

  it("blocks requests over limit", () => {
    const limiter = new SlidingWindowLog({ windowMs: 1000, max: 2 });

    limiter.consume("a");
    limiter.consume("a");
    expect(limiter.consume("a").allowed).toBe(false);
  });

  it("expires old entries correctly", () => {
    const limiter = new SlidingWindowLog({ windowMs: 1000, max: 2 });

    limiter.consume("a");
    limiter.consume("a");
    expect(limiter.consume("a").allowed).toBe(false);

    vi.advanceTimersByTime(1001);

    expect(limiter.consume("a").allowed).toBe(true);
  });

  it("handles partial window expiry", () => {
    const limiter = new SlidingWindowLog({ windowMs: 1000, max: 2 });

    limiter.consume("a"); // at t=0
    vi.advanceTimersByTime(600);
    limiter.consume("a"); // at t=600, now 2 in window → full
    expect(limiter.peek("a").allowed).toBe(false); // peek: still full at t=600

    vi.advanceTimersByTime(401); // at t=1001

    // first entry expired (t=0 is outside window [1, 1001]), one slot freed
    expect(limiter.peek("a").allowed).toBe(true);
  });

  it("handles multiple keys independently", () => {
    const limiter = new SlidingWindowLog({ windowMs: 1000, max: 1 });

    limiter.consume("a");
    expect(limiter.consume("a").allowed).toBe(false);
    expect(limiter.consume("b").allowed).toBe(true);
  });

  it("peek does not affect state", () => {
    const limiter = new SlidingWindowLog({ windowMs: 1000, max: 2 });

    limiter.consume("a");
    limiter.peek("a");
    limiter.peek("a");

    const result = limiter.consume("a");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("returns correct remaining count", () => {
    const limiter = new SlidingWindowLog({ windowMs: 1000, max: 5 });

    expect(limiter.consume("a").remaining).toBe(4);
    expect(limiter.consume("a").remaining).toBe(3);
  });

  it("peek returns full budget for a fresh key with no entry", () => {
    const limiter = new SlidingWindowLog({ windowMs: 1000, max: 5 });

    const result = limiter.peek("nonexistent");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(5);
    expect(result.resetMs).toBe(1000);
  });

  it("returns full resetMs when timestamps array is empty after pruning", () => {
    const limiter = new SlidingWindowLog({ windowMs: 500, max: 3 });

    limiter.consume("a");
    vi.advanceTimersByTime(600); // all entries pruned

    const result = limiter.consume("a");
    expect(result.remaining).toBe(2);
  });

  it("reset clears key state", () => {
    const limiter = new SlidingWindowLog({ windowMs: 1000, max: 1 });

    limiter.consume("a");
    expect(limiter.consume("a").allowed).toBe(false);

    limiter.reset("a");
    expect(limiter.consume("a").allowed).toBe(true);
  });
});
