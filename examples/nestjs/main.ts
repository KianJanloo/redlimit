import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Controller, Get, Module, UseGuards } from "@nestjs/common";
import { createRateLimiter, nestJsGuard } from "../../src/index.js";

// Rate limiter: 10 requests per 60 seconds per IP
const limiter = createRateLimiter({
  strategy: "sliding-window",
  windowMs: 60_000,
  max: 10,
});

@Controller()
class AppController {
  @Get("/")
  getRoot() {
    return { message: "Hello! Try hitting this 11 times in 60s." };
  }

  @Get("strict")
  @UseGuards(nestJsGuard({
    limiter: createRateLimiter({ strategy: "fixed-window", windowMs: 10_000, max: 3 }),
  }))
  getStrict() {
    return { message: "This endpoint allows 3 requests per 10 seconds." };
  }
}

@Module({
  controllers: [AppController],
})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Apply rate limiting globally
  app.useGlobalGuards(nestJsGuard({ limiter }));

  await app.listen(3000);
  console.log("NestJS example running at http://localhost:3000");
  console.log("  GET /          — 10 req/60s global limit");
  console.log("  GET /strict    — 3 req/10s per-route limit");
}

bootstrap();
