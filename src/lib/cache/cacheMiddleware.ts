// Cache middleware for caching API responses
// Provides get, set, and delete operations with TTL support

import { getRedisClient, isRedisAvailable } from './redisClient';
import { CACHE_TTL, CACHE_KEYS } from './cacheKeys';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  key?: string; // Custom cache key (optional)
}

/**
 * Get value from cache
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const available = await isRedisAvailable();
    if (!available) {
      return null;
    }

    const redis = getRedisClient();
    const value = await redis.get(key);
    
    if (!value) {
      return null;
    }

    return JSON.parse(value) as T;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
}

/**
 * Set value in cache with optional TTL
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  options: CacheOptions = {}
): Promise<void> {
  try {
    const available = await isRedisAvailable();
    if (!available) {
      return;
    }

    const redis = getRedisClient();
    const serialized = JSON.stringify(value);
    const ttl = options.ttl || CACHE_TTL.AI_RESPONSE;
    
    await redis.setex(key, ttl, serialized);
  } catch (error) {
    console.error('Cache set error:', error);
  }
}

/**
 * Delete value from cache
 */
export async function cacheDelete(key: string): Promise<void> {
  try {
    const available = await isRedisAvailable();
    if (!available) {
      return;
    }

    const redis = getRedisClient();
    await redis.del(key);
  } catch (error) {
    console.error('Cache delete error:', error);
  }
}

/**
 * Delete multiple keys from cache
 */
export async function cacheDeleteKeys(keys: string[]): Promise<void> {
  try {
    const available = await isRedisAvailable();
    if (!available) {
      return;
    }

    const redis = getRedisClient();
    await redis.del(...keys);
  } catch (error) {
    console.error('Cache delete multiple error:', error);
  }
}

/**
 * Clear all cache keys matching a pattern
 */
export async function cacheClearPattern(pattern: string): Promise<void> {
  try {
    const available = await isRedisAvailable();
    if (!available) {
      return;
    }

    const redis = getRedisClient();
    const keys = await redis.keys(pattern);
    
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error('Cache clear pattern error:', error);
  }
}

/**
 * Cache wrapper for async functions
 * Automatically caches function results
 */
export async function cached<T>(
  key: string,
  fn: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  // Try to get from cache first
  const cached = await cacheGet<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Execute function and cache result
  const result = await fn();
  await cacheSet(key, result, options);
  
  return result;
}

/**
 * Invalidate user-specific cache
 */
export async function invalidateUserCache(userId: string): Promise<void> {
  const keys = [
    CACHE_KEYS.USER_PROFILE(userId),
    CACHE_KEYS.USER_TEMPLATES(userId),
    CACHE_KEYS.USER_SESSIONS(userId),
    CACHE_KEYS.USER_PROGRESS(userId),
    CACHE_KEYS.PERSONAL_RECORDS(userId),
    CACHE_KEYS.ACTIVE_SESSION(userId),
    CACHE_KEYS.AI_ONBOARDING_PROGRAM(userId),
  ];

  await cacheDeleteKeys(keys);
}

/**
 * Invalidate exercise/device library cache
 */
export async function invalidateLibraryCache(): Promise<void> {
  await cacheDeleteKeys([
    CACHE_KEYS.EXERCISE_LIBRARY,
    CACHE_KEYS.DEVICE_LIBRARY,
  ]);
}
