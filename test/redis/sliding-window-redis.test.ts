import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RedisSlidingWindowLog } from "../../src/redis/sliding-window-redis.js";
import { startRedis, stopRedis, getRedis, isDockerAvailable } from "./setup.js";

let limiter: RedisSlidingWindowLog;

beforeAll(async () => {
  await startRedis();
  if (!isDockerAvailable()) return;
  limiter = new RedisSlidingWindowLog({
    redis: getRedis()!,
    prefix: "test:sw",
    windowMs: 1000,
    max: 3,
  });
});

afterAll(async () => {
  await stopRedis();
});

describe("RedisSlidingWindowLog", () => {
  it("allows requests under limit", async () => {
    if (!isDockerAvailable()) return;
    await limiter.reset("a");
    expect((await limiter.consume("a")).allowed).toBe(true);
    expect((await limiter.consume("a")).allowed).toBe(true);
    expect((await limiter.consume("a")).allowed).toBe(true);
  });

  it("blocks requests over limit", async () => {
    if (!isDockerAvailable()) return;
    await limiter.reset("b");
    await limiter.consume("b");
    await limiter.consume("b");
    expect((await limiter.consume("b")).allowed).toBe(false);
  });

  it("expires old entries correctly", async () => {
    if (!isDockerAvailable()) return;
    await limiter.reset("c");
    await limiter.consume("c");
    await limiter.consume("c");
    expect((await limiter.consume("c")).allowed).toBe(false);

    // Wait for entries to expire
    await new Promise((r) => setTimeout(r, 1100));

    expect((await limiter.consume("c")).allowed).toBe(true);
  }, 5000);

  it("handles partial window expiry", async () => {
    if (!isDockerAvailable()) return;
    await limiter.reset("d");
    await limiter.consume("d"); // t=0
    await new Promise((r) => setTimeout(r, 600));
    await limiter.consume("d"); // t=600
    expect((await limiter.peek("d")).allowed).toBe(false); // full at t=600

    await new Promise((r) => setTimeout(r, 500)); // t=1100

    // First entry expired, one slot freed
    expect((await limiter.peek("d")).allowed).toBe(true);
  }, 5000);

  it("handles multiple keys independently", async () => {
    if (!isDockerAvailable()) return;
    const strict = new RedisSlidingWindowLog({
      redis: getRedis()!,
      prefix: "test:sw:strict",
      windowMs: 1000,
      max: 1,
    });

    await strict.reset("e");
    await strict.reset("f");
    await strict.consume("e");
    expect((await strict.consume("e")).allowed).toBe(false);
    expect((await strict.consume("f")).allowed).toBe(true);
  });

  it("peek does not affect state", async () => {
    if (!isDockerAvailable()) return;
    await limiter.reset("g");
    await limiter.consume("g");
    await limiter.peek("g");
    await limiter.peek("g");

    const result = await limiter.consume("g");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("returns correct remaining count", async () => {
    if (!isDockerAvailable()) return;
    await limiter.reset("h");
    expect((await limiter.consume("h")).remaining).toBe(2);
    expect((await limiter.consume("h")).remaining).toBe(1);
  });

  it("reset clears key state", async () => {
    if (!isDockerAvailable()) return;
    await limiter.reset("i");
    await limiter.consume("i");
    expect((await limiter.consume("i")).allowed).toBe(false);

    await limiter.reset("i");
    expect((await limiter.consume("i")).allowed).toBe(true);
  });
});
