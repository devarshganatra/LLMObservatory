import crypto from 'crypto';
import pool from '../db/connection.js';
import { createModelIfNotExists } from '../repositories/modelRepository.js';
import { createRun, updateRunStatus, getPaginatedRuns, countRuns, getRunDetailsById } from '../repositories/runRepository.js';
import { insertProbeResultsBulk } from '../repositories/probeRepository.js';
import { saveRun } from '../inference/saveRun.js';
import { toRunSummaryDTO } from '../api/dto/runSummary.dto.js';
import { getLatestDriftRunByRunId } from '../repositories/driftRepository.js';
import { DatabaseError, NotFoundError } from '../errors/AppError.js';
import { logger } from '../logger/logger.js';
import { redisCache } from '../infrastructure/redis/redisCache.js';
import { redisKeys } from '../infrastructure/redis/redisKeys.js';

/**
 * Computes a deterministic config hash for model deduplication.
 */
function computeConfigHash(modelConfig, probesetVersion) {
    const payload = {
        provider: modelConfig.provider,
        model: modelConfig.model,
        temperature: modelConfig.temperature,
        max_output_tokens: modelConfig.max_output_tokens,
        top_p: modelConfig.top_p,
        probeset_version: probesetVersion
    };
    return crypto.createHash('md5').update(JSON.stringify(payload)).digest('hex');
}

/**
 * Persists a run to PostgreSQL (transactional) and JSON (for downstream compatibility).
 * @param {Object} runData - Full run object from runProbes()
 * @param {string} [userId] - Optional user ID for scoping
 * @returns {Promise<{ dbRunId: string, runId: string }>}
 */
export async function persistRun(runData, userId) {
    const { model_config, probeset_version, probe_results, started_at, completed_at, run_type } = runData;

    // 1. Always write JSON for downstream stages
    saveRun(runData);

    // 2. Persist to PostgreSQL in a single transaction
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const configHash = computeConfigHash(model_config, probeset_version);
        const modelId = await createModelIfNotExists({
            name: model_config.model,
            provider: model_config.provider,
            version: null,
            configHash
        }, client);

        const dbRunId = await createRun({
            modelId,
            probeVersion: probeset_version,
            status: 'pending',
            startedAt: started_at,
            metadata: { run_type, original_run_id: runData.run_id },
            originalRunId: runData.run_id,
            userId: userId || null
        }, client);

        await insertProbeResultsBulk(client, dbRunId, probe_results);
        await updateRunStatus(dbRunId, { status: 'completed' }, client);

        await client.query('COMMIT');
        logger.info({ dbRunId, original_id: runData.run_id }, 'Run persisted to DB');

        // Invalidate cache on new run
        await redisCache.invalidateRun(dbRunId);

        return { dbRunId, runId: runData.run_id };

    } catch (err) {
        await client.query('ROLLBACK');
        logger.error({ err, runId: runData.run_id }, 'DB Persistence failed, rolled back');
        throw new DatabaseError(`Failed to persist run: ${err.message}`);
    } finally {
        client.release();
    }
}

/**
 * Fetches paginated runs with summary DTOs.
 */
export async function getRuns(filters) {
    const cacheKey = redisKeys.cache.runsPage(filters.page || 1);

    // Attempt cache hit
    const cachedData = await redisCache.get(cacheKey);
    if (cachedData) return cachedData;

    try {
        const [rows, total] = await Promise.all([
            getPaginatedRuns(filters),
            countRuns(filters)
        ]);

        const result = {
            data: rows.map(toRunSummaryDTO),
            meta: {
                total,
                page: filters.page,
                limit: filters.limit
            }
        };

        // Cache result for 30 seconds
        await redisCache.set(cacheKey, result, 30);

        return result;
    } catch (err) {
        throw new DatabaseError(`Failed to fetch runs: ${err.message}`);
    }
}

/**
 * Fetches a single run detail with aggregated drift/insight summary markers.
 */
export async function getRunById(runId, userId) {
    const cacheKey = redisKeys.cache.run(runId);

    // Attempt cache hit
    const cachedData = await redisCache.get(cacheKey);
    if (cachedData) return cachedData;

    try {
        const run = await getRunDetailsById(runId, userId);
        if (!run) return null;

        const drift = await getLatestDriftRunByRunId(runId);

        const insightResult = await pool.query(
            'SELECT * FROM insight_runs WHERE run_id = $1 ORDER BY created_at DESC LIMIT 1',
            [runId]
        );
        const insight = insightResult.rows[0];

        const result = { run, drift, insight };

        // Cache result for 30 seconds
        await redisCache.set(cacheKey, result, 30);

        return result;
    } catch (err) {
        if (err instanceof NotFoundError) throw err;
        throw new DatabaseError(`Failed to fetch run details: ${err.message}`);
    }
}
