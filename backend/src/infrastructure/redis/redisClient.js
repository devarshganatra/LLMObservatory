import { createClient } from 'redis';
import { logger } from '../../logger/logger.js';

/**
 * Production-grade Redis Client Wrapper.
 * 
 * Features:
 * - Connection timeouts
 * - Capped exponential backoff retries
 * - Lazy connection (explicit connect() required)
 * - Safe error handling and Pino logging
 */

const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
    logger.warn('REDIS_URL not found in environment variables. Redis features will be disabled.');
}

class RedisClient {
    constructor() {
        this.client = null;
        this.isConnected = false;
    }

    /**
     * Initialize and connect the Redis client.
     * Call this explicitly in server.js.
     */
    async connect() {
        if (!REDIS_URL) return null;
        if (this.client) return this.client;

        this.client = createClient({
            url: REDIS_URL,
            socket: {
                connectTimeout: 5000, // 5 seconds timeout
                reconnectStrategy: (retries) => {
                    if (retries > 10) {
                        logger.error('Redis reconnect failed after 10 attempts');
                        return new Error('Redis reconnect failed');
                    }
                    // Exponential backoff capped at 2 seconds
                    const delay = Math.min(retries * 50, 2000);
                    logger.info({ retry_attempt: retries, delay_ms: delay }, 'Redis attempting reconnect');
                    return delay;
                }
            }
        });

        this.client.on('error', (err) => {
            logger.error({ err }, 'Redis Client Error');
            this.isConnected = false;
        });

        this.client.on('connect', () => {
            logger.info('Redis Client Connecting...');
        });

        this.client.on('ready', () => {
            logger.info('Redis Client Ready');
            this.isConnected = true;
        });

        this.client.on('end', () => {
            logger.warn('Redis Client Connection Ended');
            this.isConnected = false;
        });

        try {
            await this.client.connect();
            return this.client;
        } catch (err) {
            logger.error({ err }, 'Failed to connect to Redis');
            // We don't throw here to allow app to start even if Redis is down (fail-open strategy)
            return null;
        }
    }

    /**
     * Graceful shutdown of the Redis connection.
     */
    async quit() {
        if (this.client) {
            logger.info('Closing Redis connection...');
            await this.client.quit();
            this.client = null;
            this.isConnected = false;
        }
    }

    /**
     * Accessor for the underlying redis client.
     */
    getInstance() {
        return this.client;
    }
}

// Export singleton instance
const redisClient = new RedisClient();
export default redisClient;
export { redisClient };
