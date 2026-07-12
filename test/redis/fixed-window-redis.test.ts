import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RedisFixedWindow } from "../../src/redis/fixed-window-redis.js";
import { startRedis, stopRedis, getRedis, isDockerAvailable } from "./setup.js";

let limiter: RedisFixedWindow;

beforeAll(async () => {
  await startRedis();
  if (!isDockerAvailable()) return;
  limiter = new RedisFixedWindow({
    redis: getRedis()!,
    prefix: "test:fw",
    windowMs: 1000,
    max: 3,
  });
});

afterAll(async () => {
  await stopRedis();
});

describe("RedisFixedWindow", () => {
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

  it("resets count after window expires", async () => {
    if (!isDockerAvailable()) return;
    await limiter.reset("c");
    await limiter.consume("c");
    await limiter.consume("c");
    expect((await limiter.consume("c")).allowed).toBe(false);

    // Wait for Redis TTL to expire the key
    await new Promise((r) => setTimeout(r, 1100));

    expect((await limiter.consume("c")).allowed).toBe(true);
  }, 5000);

  it("handles multiple keys independently", async () => {
    if (!isDockerAvailable()) return;
    await limiter.reset("d");
    const strict = new RedisFixedWindow({
      redis: getRedis()!,
      prefix: "test:fw:strict",
      windowMs: 1000,
      max: 1,
    });

    await strict.consume("d");
    expect((await strict.consume("d")).allowed).toBe(false);
    expect((await strict.consume("e")).allowed).toBe(true);
  });

  it("peek does not affect state", async () => {
    if (!isDockerAvailable()) return;
    await limiter.reset("f");
    await limiter.consume("f");
    await limiter.peek("f");
    await limiter.peek("f");

    const result = await limiter.consume("f");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("returns correct remaining count", async () => {
    if (!isDockerAvailable()) return;
    await limiter.reset("g");
    expect((await limiter.consume("g")).remaining).toBe(2);
    expect((await limiter.consume("g")).remaining).toBe(1);
    expect((await limiter.consume("g")).remaining).toBe(0);
  });

  it("reset clears key state", async () => {
    if (!isDockerAvailable()) return;
    await limiter.reset("h");
    await limiter.consume("h");
    expect((await limiter.consume("h")).allowed).toBe(false);

    await limiter.reset("h");
    expect((await limiter.consume("h")).allowed).toBe(true);
  });
});
