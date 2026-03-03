import fs from 'fs';
import path from 'path';
import pool from '../db/connection.js';
import { createDriftRun, insertDriftProbeResultsBulk, getLatestDriftRunByRunId, getDriftProbeResultsByDriftRunId } from '../repositories/driftRepository.js';
import { getRunByOriginalId } from '../repositories/runRepository.js';
import { getBaselineByOriginalId } from '../repositories/baselineRepository.js';
import { toDriftDTO } from '../api/dto/drift.dto.js';
import { DatabaseError } from '../errors/AppError.js';
import { logger } from '../logger/logger.js';

/**
 * UUID Regex helper
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Persists a drift result to JSON and PostgreSQL.
 */
export async function persistDriftResult(driftResult, jsonOutputPath, options = {}) {
    let { dbRunId = null, confidence = null } = options;
    let baselineId = driftResult.baseline_id;

    // 1. Always write JSON first
    const dir = path.dirname(jsonOutputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(jsonOutputPath, JSON.stringify(driftResult, null, 2));

    try {
        // 2. Resolve DB Run ID if not provided
        if (!dbRunId) {
            const run = await getRunByOriginalId(driftResult.run_id);
            if (run) {
                dbRunId = run.id;
            } else {
                logger.warn({ original_id: driftResult.run_id }, 'No run record found for drift persistence');
                return { driftRunId: null };
            }
        }

        // 3. Resolve Baseline ID (slug -> UUID)
        if (baselineId && !UUID_REGEX.test(baselineId)) {
            const baseline = await getBaselineByOriginalId(baselineId);
            if (baseline) {
                baselineId = baseline.id;
            } else {
                logger.warn({ baseline_slug: baselineId }, 'No baseline record found for drift persistence');
                return { driftRunId: null };
            }
        }
    } catch (err) {
        throw new DatabaseError(`Failed to resolve prerequisites for drift: ${err.message}`);
    }

    // 4. Persist to PostgreSQL in a single transaction
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const driftRunId = await createDriftRun({
            runId: dbRunId,
            baselineId: baselineId,
            driftDetected: driftResult.run_decision.drift_detected,
            triggerReason: driftResult.run_decision.trigger_reason,
            weightedMean: driftResult.run_decision.weighted_mean,
            classification: driftResult.run_decision.classification,
            driftState: driftResult.run_decision.drift_state,
            confidence: confidence
        }, client);

        await insertDriftProbeResultsBulk(client, driftRunId, driftResult.probe_results);

        await client.query('COMMIT');
        logger.info({ driftRunId, dbRunId }, 'Drift result persisted to DB');

        return { driftRunId };

    } catch (err) {
        await client.query('ROLLBACK');
        logger.error({ err, dbRunId }, 'Drift transaction failed');
        throw new DatabaseError(`Failed to persist drift results: ${err.message}`);
    } finally {
        client.release();
    }
}

/**
 * Fetches drift details for a run.
 */
export async function getDriftByRunId(runId) {
    try {
        const driftRun = await getLatestDriftRunByRunId(runId);
        if (!driftRun) return null;

        const probeResults = await getDriftProbeResultsByDriftRunId(driftRun.id);
        return toDriftDTO(driftRun, probeResults);
    } catch (err) {
        throw new DatabaseError(`Failed to fetch drift for run ${runId}: ${err.message}`);
    }
}
