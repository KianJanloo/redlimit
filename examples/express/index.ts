import express from "express";
import { createRateLimiter, expressMiddleware } from "../../src/index.js";

const app = express();
const PORT = 3000;

// Rate limiter: 10 requests per 60 seconds per IP
const limiter = createRateLimiter({
  strategy: "sliding-window",
  windowMs: 60_000,
  max: 10,
});

// Apply globally
app.use(expressMiddleware({ limiter }));

// Custom key generator — rate limit by API key header
const apiLimiter = createRateLimiter({
  strategy: "fixed-window",
  windowMs: 60_000,
  max: 5,
});

app.use(
  "/api",
  expressMiddleware({
    limiter: apiLimiter,
    keyGenerator: (req) => (req.headers["x-api-key"] as string) ?? req.ip ?? "unknown",
  }),
);

// Routes
app.get("/", (_req, res) => {
  res.json({ message: "Hello! Try hitting this 11 times in 60s." });
});

app.get("/api/data", (_req, res) => {
  res.json({ data: [1, 2, 3] });
});

// Custom rate-limit handler
const strictLimiter = createRateLimiter({
  strategy: "sliding-window",
  windowMs: 10_000,
  max: 3,
});

app.get(
  "/strict",
  expressMiddleware({
    limiter: strictLimiter,
    onRateLimit: (_req, res, result) => {
      res.status(429).json({
        error: "Rate limit exceeded",
        retryAfter: Math.ceil(result.resetMs / 1000),
        remaining: result.remaining,
      });
    },
  }),
  (_req, res) => {
    res.json({ message: "This endpoint allows 3 requests per 10 seconds." });
  },
);

app.listen(PORT, () => {
  console.log(`Express example running at http://localhost:${PORT}`);
  console.log("  GET /          — 10 req/60s global limit");
  console.log("  GET /api/data  — 5 req/60s per API key");
  console.log("  GET /strict    — 3 req/10s with custom handler");
});
