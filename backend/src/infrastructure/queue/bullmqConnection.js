import Redis from 'ioredis';
import { logger } from '../../logger/logger.js';

const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
    logger.warn('REDIS_URL not set. BullMQ will not be able to connect.');
}

/**
 * Creates a new ioredis connection for BullMQ.
 *
 * BullMQ internally creates multiple connections per queue/worker,
 * so we export a factory function rather than a singleton.
 *
 * Configuration:
 * - connectTimeout: 5000ms
 * - Capped exponential backoff retry (max 10 retries, max 2s delay)
 * - Pino logging for connect, ready, close, and error events
 */
export function createBullMQConnection() {
    const connection = new Redis(REDIS_URL, {
        connectTimeout: 5000,
        maxRetriesPerRequest: null, // Required by BullMQ
        enableReadyCheck: false,    // Required by BullMQ
        retryStrategy(retries) {
            if (retries > 10) {
                logger.error('BullMQ Redis: max reconnect attempts reached');
                return null; // Stop retrying
            }
            const delay = Math.min(retries * 100, 2000);
            logger.info({ retry_attempt: retries, delay_ms: delay }, 'BullMQ Redis reconnecting');
            return delay;
        }
    });

    connection.on('connect', () => logger.info('BullMQ Redis: connecting'));
    connection.on('ready', () => logger.info('BullMQ Redis: ready'));
    connection.on('close', () => logger.warn('BullMQ Redis: connection closed'));
    connection.on('error', (err) => logger.error({ err }, 'BullMQ Redis: error'));

    return connection;
}
