import express from 'express';
import pool from '../../db/connection.js';
import redisClient from '../../infrastructure/redis/redisClient.js';
import { logger } from '../../logger/logger.js';

const router = express.Router();

/**
 * GET /api/system/health
 * Comprehensive health check for PostgreSQL and Redis.
 */
router.get('/health', async (req, res) => {
    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {
            database: { status: 'unknown' },
            redis: { status: 'unknown' }
        }
    };

    // 1. Check PostgreSQL
    try {
        const dbStart = Date.now();
        await pool.query('SELECT 1');
        health.services.database = {
            status: 'up',
            latency_ms: Date.now() - dbStart
        };
    } catch (err) {
        logger.error({ err }, 'Health Check: Database Down');
        health.status = 'error';
        health.services.database = { status: 'down', error: err.message };
    }

    // 2. Check Redis
    const client = redisClient.getInstance();
    if (client && redisClient.isConnected) {
        try {
            const redisStart = Date.now();
            await client.ping();
            health.services.redis = {
                status: 'up',
                latency_ms: Date.now() - redisStart
            };
        } catch (err) {
            logger.error({ err }, 'Health Check: Redis Ping Failed');
            health.status = 'error';
            health.services.redis = { status: 'down', error: err.message };
        }
    } else {
        health.status = 'degraded';
        health.services.redis = { status: 'down', message: 'Redis client not connected' };
    }

    const statusCode = health.status === 'ok' ? 200 : (health.status === 'degraded' ? 200 : 503);
    res.status(statusCode).json(health);
});

export default router;
