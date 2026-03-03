/**
 * Run Repository — SQL-only data access layer
 */

import pool from '../db/connection.js';

/**
 * Creates a new run record.
 * @param {Object} params
 * @param {import('pg').PoolClient} [client] - Optional transaction client
 * @returns {Promise<string>} run UUID
 */
export async function createRun({ modelId, probeVersion, status, startedAt, metadata, originalRunId, userId }, client) {
    const conn = client || pool;

    const result = await conn.query(
        `INSERT INTO runs (model_id, probe_version, status, started_at, metadata, original_run_id, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [modelId, probeVersion, status, startedAt, metadata ? JSON.stringify(metadata) : null, originalRunId || null, userId || null]
    );

    return result.rows[0].id;
}

/**
 * Finds a run by its original string/timestamp ID.
 * @param {string} originalRunId
 * @returns {Promise<Object|null>} Run record or null
 */
export async function getRunByOriginalId(originalRunId) {
    const result = await pool.query(
        `SELECT id, model_id, probe_version, status, started_at, metadata, original_run_id
         FROM runs
         WHERE original_run_id = $1`,
        [originalRunId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Updates run status and merges metadata.
 * @param {string} runId
 * @param {Object} params - { status, lastError, metadata }
 * @param {import('pg').PoolClient} [client]
 */
export async function updateRunStatus(runId, { status, lastError, metadata }, client) {
    const conn = client || pool;

    // 1. Fetch existing metadata to merge
    const current = await conn.query('SELECT metadata FROM runs WHERE id = $1', [runId]);
    const mergedMetadata = {
        ...(current.rows[0]?.metadata || {}),
        ...(metadata || {})
    };

    const completedAt = (status === 'completed' || status === 'failed') ? new Date().toISOString() : null;

    await conn.query(
        `UPDATE runs 
         SET status = $1, 
             last_error = $2, 
             metadata = $3,
             completed_at = COALESCE($4, completed_at)
         WHERE id = $5`,
        [status, lastError || null, JSON.stringify(mergedMetadata), completedAt, runId]
    );
}

/**
 * Comprehensive fetch for drift engine.
 * @param {string} runId
 */
export async function getRunDetailsById(runId, userId) {
    let query = `
        SELECT r.id, r.model_id, r.probe_version, r.status, r.started_at, r.metadata, r.original_run_id, r.user_id,
                m.name as model_name, m.provider, m.config_hash
         FROM runs r
         JOIN models m ON r.model_id = m.id
         WHERE r.id = $1
    `;
    const params = [runId];

    if (userId) {
        query += ` AND r.user_id = $2`;
        params.push(userId);
    }

    const result = await pool.query(query, params);

    return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Paginated list of runs for API.
 */
export async function getPaginatedRuns({ limit = 10, offset = 0, model = null, classification = null, userId = null }) {
    let query = `
        SELECT r.id, r.status, r.started_at, r.probe_version,
               m.name as model_name,
               dr.drift_state, dr.classification,
               ir.dominant_event
        FROM runs r
        JOIN models m ON r.model_id = m.id
        LEFT JOIN drift_runs dr ON dr.run_id = r.id
        LEFT JOIN insight_runs ir ON ir.run_id = r.id
        WHERE 1=1
    `;
    const params = [];

    if (userId) {
        params.push(userId);
        query += ` AND r.user_id = $${params.length}`;
    }

    if (model) {
        params.push(model);
        query += ` AND m.name = $${params.length}`;
    }
    if (classification) {
        params.push(classification);
        query += ` AND dr.classification = $${params.length}`;
    }

    query += ` ORDER BY r.started_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
}

/**
 * Count total runs for pagination meta.
 */
export async function countRuns({ model = null, classification = null, userId = null }) {
    let query = `
        SELECT COUNT(*) 
        FROM runs r
        JOIN models m ON r.model_id = m.id
        LEFT JOIN drift_runs dr ON dr.run_id = r.id
        WHERE 1=1
    `;
    const params = [];

    if (userId) {
        params.push(userId);
        query += ` AND r.user_id = $${params.length}`;
    }

    if (model) {
        params.push(model);
        query += ` AND m.name = $${params.length}`;
    }
    if (classification) {
        params.push(classification);
        query += ` AND dr.classification = $${params.length}`;
    }

    const result = await pool.query(query, params);
    return parseInt(result.rows[0].count, 10);
}

