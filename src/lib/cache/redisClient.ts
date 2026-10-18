// Redis client configuration
// Handles Redis connection and caching operations

import Redis from 'ioredis';

let client: Redis | null = null;

export function getRedisClient(): Redis {
  if (!client) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    client = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      // Fail fast while disconnected so callers fall back instead of hanging.
      enableOfflineQueue: false,
      connectTimeout: 2000,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      enableReadyCheck: true,
    });

    let lastLog = 0;
    client.on('error', (error) => {
      // A down Redis reconnects in a loop; log at most once a minute.
      if (Date.now() - lastLog > 60_000) {
        lastLog = Date.now();
        console.error('Redis Client Error:', error.message);
      }
    });

    client.on('connect', () => {
      console.log('Redis Client Connected');
    });
  }
  
  return client;
}

export function resetRedisClient(): void {
  if (client) {
    client.quit();
    client = null;
  }
}

/**
 * Check if Redis is available
 */
export async function isRedisAvailable(): Promise<boolean> {
  try {
    const redis = getRedisClient();
    await redis.ping();
    return true;
  } catch (error) {
    console.error('Redis is not available:', error);
    return false;
  }
}

/**
 * Gracefully close Redis connection
 */
export async function closeRedisConnection(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
