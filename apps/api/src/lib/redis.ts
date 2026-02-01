import Redis from 'ioredis';
import type { Redis as RedisType } from 'ioredis';

const REDIS_URL = process.env.REDIS_URL;
const REDIS_ENABLED = !!REDIS_URL;

let redis: RedisType | null = null;

if (REDIS_ENABLED) {
  // @ts-expect-error - ioredis default export typing issue with ESM
  redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    lazyConnect: true
  });

  redis.on('error', (error: Error) => {
    console.error('Redis connection error:', error);
  });

  redis.on('connect', () => {
    console.log('Redis connected');
  });
} else {
  console.log('Redis not configured - caching disabled');
}

export { redis };

/**
 * Cache helper with JSON serialization
 * Gracefully degrades to no-op when Redis is not available
 */
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    if (!redis) return null;
    try {
      const value = await redis.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  },

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    if (!redis) return;
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await redis.setex(key, ttlSeconds, serialized);
      } else {
        await redis.set(key, serialized);
      }
    } catch {
      // Ignore cache errors
    }
  },

  async del(key: string): Promise<void> {
    if (!redis) return;
    try {
      await redis.del(key);
    } catch {
      // Ignore cache errors
    }
  },

  async exists(key: string): Promise<boolean> {
    if (!redis) return false;
    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch {
      return false;
    }
  }
};

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  POKEMON_SPECIES: 60 * 60 * 24,     // 24 hours
  POKEMON_LIST: 60 * 60 * 24,        // 24 hours
  USER_SESSION: 60 * 60,             // 1 hour
  SHOP_ITEMS: 60 * 5                 // 5 minutes
};
