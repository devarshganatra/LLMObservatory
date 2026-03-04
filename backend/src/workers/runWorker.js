import 'dotenv-flow/config';
import { Worker } from 'bullmq';
import { createBullMQConnection } from '../infrastructure/queue/bullmqConnection.js';
import { QUEUE_NAME } from '../infrastructure/queue/runQueue.js';
import * as runService from '../services/runService.js';
import { logger } from '../logger/logger.js';


const CONCURRENCY = 3;

const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
        const { runId } = job.data;
        const jobStart = Date.now();

        logger.info({
            event: 'job_started',
            job_id: job.id,
            run_id: runId,
            attempt: job.attemptsMade + 1
        }, 'Run pipeline job started');

        // Delegate all business logic to the service layer
        await runService.executeRunPipeline(runId);

        const durationMs = Date.now() - jobStart;
        logger.info({
            event: 'job_completed',
            job_id: job.id,
            run_id: runId,
            duration_ms: durationMs
        }, 'Run pipeline job completed');
    },
    {
        connection: createBullMQConnection(),
        concurrency: CONCURRENCY,
        limiter: {
            max: CONCURRENCY,
            duration: 1000
        }
    }
);

/**
 * Worker event listeners for observability.
 */
worker.on('failed', (job, err) => {
    logger.error({
        event: 'job_failed',
        job_id: job?.id,
        run_id: job?.data?.runId,
        attempt: job?.attemptsMade,
        err: err.message
    }, 'Run pipeline job failed');
});

worker.on('stalled', (jobId) => {
    logger.warn({ event: 'job_stalled', job_id: jobId }, 'Run pipeline job stalled');
});

logger.info({ queue: QUEUE_NAME, concurrency: CONCURRENCY }, '🏭 Run Worker started');

/**
 * Graceful Shutdown
 * Order: stop accepting new jobs → finish active jobs → close Redis → exit
 */
const shutdown = async (signal) => {
    logger.info({ signal }, 'Worker graceful shutdown initiated');

    const forceQuit = setTimeout(() => {
        logger.error('Worker shutdown timed out, forcing exit');
        process.exit(1);
    }, 30_000); // Allow up to 30s for active jobs to finish

    try {
        // This waits for the currently active job(s) to complete before closing
        await worker.close();
        logger.info('Worker closed (active jobs finished)');

        clearTimeout(forceQuit);
        logger.info('Worker shutdown complete');
        process.exit(0);
    } catch (err) {
        logger.error({ err }, 'Error during worker shutdown');
        process.exit(1);
    }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
