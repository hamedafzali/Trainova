// Redis client configuration
// Handles Redis connection and caching operations

import Redis from 'ioredis';

let client: Redis | null = null;

export function getRedisClient(): Redis {
  if (!client) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      enableReadyCheck: true,
    });

    client.on('error', (error) => {
      console.error('Redis Client Error:', error);
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
