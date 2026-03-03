/**
 * Probe Repository — SQL-only data access layer
 */

import pool from '../db/connection.js';

/**
 * Inserts all probe results for a run in a single transaction.
 * Must be called with a transaction client.
 * @param {import('pg').PoolClient} client - Transaction client (required)
 * @param {string} runId - Run UUID
 * @param {Array} probeResults - Array of probe result objects from runProbes()
 */
export async function insertProbeResultsBulk(client, runId, probeResults) {
    for (const probe of probeResults) {
        await client.query(
            `INSERT INTO probe_results (run_id, probe_id, response_text, token_count, sentence_count)
             VALUES ($1, $2, $3, $4, $5)`,
            [
                runId,
                probe.probe_id,
                probe.response_text,
                probe.response_text ? Math.ceil(probe.response_text.length / 4) : null,
                probe.response_text ? (probe.response_text.match(/[.!?]+/g) || []).length : null
            ]
        );
    }
}

/**
 * Updates the feature vector for a specific probe result.
 */
export async function updateProbeFeatureVector(runId, probeId, featureVector) {
    await pool.query(
        `UPDATE probe_results 
         SET feature_vector = $1 
         WHERE run_id = $2 AND probe_id = $3`,
        [JSON.stringify(featureVector), runId, probeId]
    );
}

/**
 * Fetches all results for a run to feed into the drift engine.
 * @param {string} runId
 */
export async function getProbeResultsByRunId(runId) {
    const result = await pool.query(
        `SELECT probe_id, response_text, feature_vector, sentence_count, token_count
         FROM probe_results
         WHERE run_id = $1`,
        [runId]
    );

    return result.rows;
}
