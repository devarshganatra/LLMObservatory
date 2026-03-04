import 'dotenv-flow/config';
import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { logger } from './src/logger/logger.js';
import { requestId } from './src/api/middleware/requestId.js';
import { errorHandler } from './src/errors/errorHandler.js';
import pool from './src/db/connection.js';
import * as qdrantService from './src/embeddings/qdrantService.js';

import { protect, requireRole } from './src/api/middleware/auth.middleware.js';
import redisClient from './src/infrastructure/redis/redisClient.js';
import systemRoutes from './src/api/routes/system.routes.js';

const app = express();
const PORT = process.env.PORT || 3000;

// CORS — allow frontend origin
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Middleware
app.use(requestId);
app.use(pinoHttp({
    logger,
    genReqId: (req) => req.requestId,
    customSuccessMessage: (req, res) => `${req.method} ${req.url} completed ${res.statusCode}`,
    customErrorMessage: (req, res, err) => `${req.method} ${req.url} failed ${res.statusCode}: ${err.message}`
}));
app.use(express.json());

// Routes Mounting
app.use('/api/system', systemRoutes);
app.use('/api/auth', authRoutes);

// Protected Routes
app.use('/api/runs', protect, runsRoutes);
app.use('/api/runs', protect, driftRoutes);
app.use('/api/runs', protect, insightsRoutes);
app.use('/api/baselines', protect, requireRole('admin'), baselinesRoutes);

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'OK' });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        error: {
            message: `Route ${req.method} ${req.url} not found`,
            code: 'NOT_FOUND'
        }
    });
});

// Global Error Handler
app.use(errorHandler);

// Startup
const start = async () => {
    try {
        // Connect to Redis (Lazy Connect)
        await redisClient.connect();

        const server = app.listen(PORT, () => {
            logger.info({ port: PORT, env: process.env.NODE_ENV }, '🚀 LLM Observatory API Server started');
        });

        return server;
    } catch (err) {
        logger.error({ err }, 'Failed to start server');
        process.exit(1);
    }
};

const server = await start();

/**
 * Graceful Shutdown Handling
 */
const shutdown = async (signal) => {
    logger.info({ signal }, 'Graceful resource teardown initiated');

    // Set a forced exit fallback
    const forceQuit = setTimeout(() => {
        logger.error('Graceful shutdown timed out, forcing exit');
        process.exit(1);
    }, 10000);

    try {
        // 1. Stop server from accepting new requests
        server.close(() => {
            logger.info('HTTP server closed');
        });

        // 2. Close Redis connection
        await redisClient.quit();
        logger.info('Redis connection closed');

        // 3. Close DB connections
        await pool.end();
        logger.info('PostgreSQL pool closed');

        // 4. Close Qdrant client
        await qdrantService.closeClient();
        logger.info('Qdrant client closed');

        clearTimeout(forceQuit);
        logger.info('Shutdown complete');
        process.exit(0);
    } catch (err) {
        logger.error({ err }, 'Error during graceful shutdown');
        process.exit(1);
    }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
