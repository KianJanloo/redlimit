import { GenericContainer, type StartedTestContainer } from "testcontainers";
import Redis from "ioredis";

let container: StartedTestContainer | null = null;
let redis: Redis | null = null;
let dockerAvailable = false;

/** Check if Docker is available by attempting to connect. */
async function checkDocker(): Promise<boolean> {
  try {
    const testContainer = await new GenericContainer("redis:7-alpine")
      .withExposedPorts(6379)
      .start();
    await testContainer.stop();
    return true;
  } catch {
    return false;
  }
}

/** Start a Redis container and return the connected client. Returns null if Docker is unavailable. */
export async function startRedis(): Promise<Redis | null> {
  try {
    container = await new GenericContainer("redis:7-alpine")
      .withExposedPorts(6379)
      .start();

    const host = container.getHost();
    const port = container.getMappedPort(6379);

    redis = new Redis({ host, port, maxRetriesPerRequest: 3 });
    dockerAvailable = true;
    return redis;
  } catch {
    console.warn("Docker not available — skipping Redis integration tests");
    dockerAvailable = false;
    return null;
  }
}

/** Stop the Redis container and disconnect. */
export async function stopRedis(): Promise<void> {
  if (redis) {
    await redis.quit().catch(() => {});
    redis = null;
  }
  if (container) {
    await container.stop().catch(() => {});
    container = null;
  }
}

/** Get the shared Redis client (call after startRedis). */
export function getRedis(): Redis | null {
  return redis;
}

/** Check if Docker/Redis is available. */
export function isDockerAvailable(): boolean {
  return dockerAvailable;
}
