/**
 * Drift Repository — SQL-only data access layer
 *
 * Passive: no business logic, no recomputation.
 * All values (including confidence) are pre-computed by callers.
 */

import pool from '../db/connection.js';

/**
 * Sanitizes an object for JSONB insertion: replaces undefined values with null.
 * @param {Object|null} obj
 * @returns {string|null} JSON string safe for parameterized insert
 */
function safeJsonb(obj) {
    if (obj == null) return null;
    return JSON.stringify(obj, (key, value) => value === undefined ? null : value);
}

/**
 * Creates a new drift_run record.
 * @param {Object} params - Pre-computed drift result values
 * @param {string|null} params.runId - FK to runs(id), nullable during migration
 * @param {string} params.baselineId - FK to baselines(id)
 * @param {boolean} params.driftDetected
 * @param {string} params.triggerReason
 * @param {number} params.weightedMean - Raw float, no rounding
 * @param {string} params.classification - 'INFO' | 'WARNING' | 'CRITICAL'
 * @param {string} params.driftState - 'STABLE' | 'PENDING' | 'CONFIRMED'
 * @param {number|null} params.confidence - Pre-computed, passed as-is
 * @param {import('pg').PoolClient} [client] - Optional transaction client
 * @returns {Promise<string>} drift_run UUID
 */
export async function createDriftRun(
    { runId, baselineId, driftDetected, triggerReason, weightedMean, classification, driftState, confidence },
    client
) {
    const conn = client || pool;

    const result = await conn.query(
        `INSERT INTO drift_runs (run_id, baseline_id, drift_detected, trigger_reason, weighted_mean, classification, drift_state, confidence)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
            runId || null,
            baselineId,
            driftDetected,
            triggerReason,
            weightedMean,     // raw float
            classification,
            driftState,
            confidence ?? null // raw float, preserve null
        ]
    );

    return result.rows[0].id;
}

/**
 * Bulk inserts drift probe results within a transaction.
 * Must be called AFTER createDriftRun returns driftRunId.
 *
 * All float fields are inserted as raw values (no toFixed).
 * JSONB fields use safeJsonb() to map undefined → null.
 *
 * @param {import('pg').PoolClient} client - Transaction client (required)
 * @param {string} driftRunId - FK to drift_runs(id)
 * @param {Array<Object>} probeResults - Array from driftEngine output
 */
export async function insertDriftProbeResultsBulk(client, driftRunId, probeResults) {
    for (const probe of probeResults) {
        await client.query(
            `INSERT INTO drift_probe_results
                (drift_run_id, probe_id, embedding_score, feature_score, raw_probe_score, final_probe_score, volatility, system_error, segment_scores, cluster_scores)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
                driftRunId,
                probe.probe_id,
                probe.embedding_score ?? null,    // raw float
                probe.feature_score ?? null,      // raw float
                probe.raw_probe_score ?? null,    // raw float
                probe.final_probe_score ?? null,  // raw float
                probe.volatility || null,
                probe.system_error ? true : false,
                safeJsonb(probe.segment_scores),  // null-safe JSONB
                safeJsonb(probe.cluster_scores)   // null-safe JSONB
            ]
        );
    }
}

/**
 * Finds the latest drift_run for a specific DB run UUID.
 * @param {string} runId - UUID from runs(id)
 * @returns {Promise<Object|null>} Drift run record or null
 */
export async function getLatestDriftRunByRunId(runId) {
    const result = await pool.query(
        `SELECT dr.id, dr.run_id, dr.baseline_id, dr.drift_detected, dr.trigger_reason, 
                dr.weighted_mean, dr.classification, dr.drift_state, dr.confidence,
                r.original_run_id
         FROM drift_runs dr
         JOIN runs r ON dr.run_id = r.id
         WHERE dr.run_id = $1
         ORDER BY dr.created_at DESC
         LIMIT 1`,
        [runId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Fetches a drift run by its UUID.
 */
export async function getDriftRunById(driftRunId) {
    const result = await pool.query(
        `SELECT dr.*, r.original_run_id 
         FROM drift_runs dr
         JOIN runs r ON dr.run_id = r.id
         WHERE dr.id = $1`,
        [driftRunId]
    );
    return result.rows[0];
}

/**
 * Fetches probe results for a drift run.
 */
export async function getDriftProbeResultsByDriftRunId(driftRunId) {
    const result = await pool.query(
        `SELECT * FROM drift_probe_results WHERE drift_run_id = $1`,
        [driftRunId]
    );
    return result.rows;
}

