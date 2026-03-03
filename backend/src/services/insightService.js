import fs from 'fs';
import path from 'path';
import pool from '../db/connection.js';
import {
    createInsightRun,
    insertInsightProbeEventsBulk,
    insertInsightSystemEventsBulk
} from '../repositories/insightRepository.js';
import { getRunByOriginalId } from '../repositories/runRepository.js';
import { getLatestDriftRunByRunId } from '../repositories/driftRepository.js';
import { toInsightDTO } from '../api/dto/insight.dto.js';
import { DatabaseError } from '../errors/AppError.js';
import { logger } from '../logger/logger.js';

/**
 * Persists an insight report to JSON and PostgreSQL.
 */
export async function persistInsightResult(insightReport, jsonOutputPath, options = {}) {
    let { dbRunId = null, driftRunId = null } = options;

    const dir = path.dirname(jsonOutputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(jsonOutputPath, JSON.stringify(insightReport, null, 2));

    try {
        if (!dbRunId) {
            const run = await getRunByOriginalId(insightReport.run_id);
            if (run) dbRunId = run.id;
            else {
                logger.warn({ original_id: insightReport.run_id }, 'No DB run found for insight persistence');
                return { insightRunId: null };
            }
        }

        if (!driftRunId) {
            const driftRun = await getLatestDriftRunByRunId(dbRunId);
            if (driftRun) driftRunId = driftRun.id;
            else {
                logger.warn({ dbRunId }, 'No drift run found for insight persistence');
                return { insightRunId: null };
            }
        }
    } catch (err) {
        throw new DatabaseError(`Failed to resolve prerequisites for insight: ${err.message}`);
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const insightRunId = await createInsightRun({
            runId: dbRunId,
            driftRunId: driftRunId,
            summary: insightReport.summary,
            dominantEvent: insightReport.dominant_event,
            confidence: insightReport.run_confidence,
            consistencyHash: insightReport.consistency_hash
        }, client);

        await insertInsightProbeEventsBulk(client, insightRunId, insightReport.probe_insights);
        await insertInsightSystemEventsBulk(client, insightRunId, insightReport.system_events);

        await client.query('COMMIT');
        logger.info({ insightRunId, dbRunId }, 'Insight result persisted to DB');

        return { insightRunId };

    } catch (err) {
        await client.query('ROLLBACK');
        logger.error({ err, dbRunId }, 'Insight transaction failed');
        throw new DatabaseError(`Failed to persist insights: ${err.message}`);
    } finally {
        client.release();
    }
}

/**
 * Fetches insight details for a run.
 */
export async function getInsightsByRunId(runId) {
    try {
        const res = await pool.query(
            'SELECT * FROM insight_runs WHERE run_id = $1 ORDER BY created_at DESC LIMIT 1',
            [runId]
        );
        const insightRun = res.rows[0];
        if (!insightRun) return null;

        const [probeRes, systemRes] = await Promise.all([
            pool.query('SELECT * FROM insight_probe_events WHERE insight_run_id = $1', [insightRun.id]),
            pool.query('SELECT * FROM insight_system_events WHERE insight_run_id = $1', [insightRun.id])
        ]);

        return toInsightDTO(insightRun, probeRes.rows, systemRes.rows);
    } catch (err) {
        throw new DatabaseError(`Failed to fetch insights for run ${runId}: ${err.message}`);
    }
}
