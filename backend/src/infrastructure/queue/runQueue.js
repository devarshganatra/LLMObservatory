import { Queue } from 'bullmq';
import { createBullMQConnection } from './bullmqConnection.js';
import { logger } from '../../logger/logger.js';

export const QUEUE_NAME = 'run-processing';

/**
 * Singleton BullMQ Queue for run pipeline execution.
 *
 * Job Configuration:
 * - 3 retries with exponential backoff on failure
 * - 60 second execution timeout (prevents frozen pipelines)
 * - Completed jobs auto-removed after 100 kept (for light audit)
 * - Failed jobs kept for 500 entries (for debugging)
 */
const runQueue = new Queue(QUEUE_NAME, {
    connection: createBullMQConnection(),
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000 // 5s, 10s, 20s
        },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 }
    }
});

/**
 * Enqueues a run pipeline job.
 * @param {string} dbRunId - The PostgreSQL UUID of the pending run
 * @returns {Promise<import('bullmq').Job>} The created job
 */
export async function enqueueRunJob(dbRunId) {
    const job = await runQueue.add(
        'execute-run',
        { runId: dbRunId },
        {
            jobId: dbRunId, // Idempotent: one job per run ID
            timeout: 60_000 // 60 second hard timeout
        }
    );

    logger.info({ event: 'job_enqueued', run_id: dbRunId, job_id: job.id }, 'Run job enqueued');
    return job;
}

export default runQueue;
