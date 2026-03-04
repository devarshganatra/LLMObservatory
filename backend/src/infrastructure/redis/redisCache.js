import redisClient from './redisClient.js';
import { logger } from '../../logger/logger.js';
import { redisKeys } from './redisKeys.js';

/**
 * Generic Redis Caching Helper.
 * 
 * Supports:
 * - JSON serialization
 * - TTL
 * - Targeted invalidation
 * - Fallback if Redis is down
 */

const DEFAULT_TTL = 3600; // 1 hour

export const redisCache = {
    /**
     * Get value from cache with safe parsing.
     */
    async get(key) {
        const client = redisClient.getInstance();
        if (!client || !redisClient.isConnected) return null;

        try {
            const value = await client.get(key);
            if (value) {
                logger.info({ event: 'cache_hit', key }, 'Cache Hit');
                return JSON.parse(value);
            }

            logger.info({ event: 'cache_miss', key }, 'Cache Miss');
            return null;
        } catch (err) {
            logger.error({ err, key }, 'Redis Cache Get Error');
            return null;
        }
    },

    /**
     * Set value in cache with JSON serialization.
     */
    async set(key, value, ttlSeconds = DEFAULT_TTL) {
        const client = redisClient.getInstance();
        if (!client || !redisClient.isConnected) return false;

        try {
            const serialized = JSON.stringify(value);
            await client.set(key, serialized, {
                EX: ttlSeconds
            });
            return true;
        } catch (err) {
            logger.error({ err, key }, 'Redis Cache Set Error');
            return false;
        }
    },

    /**
     * Delete specific key.
     */
    async del(key) {
        const client = redisClient.getInstance();
        if (!client || !redisClient.isConnected) return false;

        try {
            await client.del(key);
            return true;
        } catch (err) {
            logger.error({ err, key }, 'Redis Cache Del Error');
            return false;
        }
    },

    /**
     * Invalidate by pattern (use with caution in prod).
     */
    async invalidatePattern(pattern) {
        const client = redisClient.getInstance();
        if (!client || !redisClient.isConnected) return false;

        try {
            const keys = await client.keys(pattern);
            if (keys.length > 0) {
                await client.del(keys);
            }
            return true;
        } catch (err) {
            logger.error({ err, pattern }, 'Redis Cache InvalidatePattern Error');
            return false;
        }
    },

    /**
     * Targeted invalidation for a specific run.
     */
    async invalidateRun(runId) {
        logger.info({ runId }, 'Invalidating cache for run');
        await Promise.all([
            this.del(redisKeys.cache.run(runId)),
            this.del(redisKeys.cache.drift(runId)),
            this.del(redisKeys.cache.insights(runId)),
            this.invalidateRunsList()
        ]);
    },

    /**
     * Invalidate all runs list pages.
     */
    async invalidateRunsList() {
        await this.invalidatePattern(redisKeys.patterns.allRuns);
    }
};
