/**
 * Baseline Repository — SQL-only data access layer
 *
 * Baselines are immutable: INSERT only, no UPDATE.
 */

import pool from '../db/connection.js';

/**
 * Creates a new baseline record.
 * @param {Object} params
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<string>} baseline UUID
 */
export async function createBaseline({ modelId, configHash, probeVersion, sampleSize, originalBaselineId }, client) {
    const conn = client || pool;
    const result = await conn.query(
        `INSERT INTO baselines (model_id, config_hash, probe_version, sample_size, original_baseline_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [modelId, configHash, probeVersion, sampleSize, originalBaselineId || null]
    );
    return result.rows[0].id;
}

/**
 * Finds a baseline by its original string ID (slug).
 * @param {string} originalBaselineId
 * @returns {Promise<Object|null>} Baseline UUID or null
 */
export async function getBaselineByOriginalId(originalBaselineId) {
    const result = await pool.query(
        `SELECT id FROM baselines WHERE original_baseline_id = $1`,
        [originalBaselineId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Bulk inserts embedding baselines within a transaction.
 * Centroid vectors are stored as text-cast pgvector values.
 * @param {import('pg').PoolClient} client
 * @param {string} baselineId
 * @param {Array} embeddings - Array of { probe_id, embedding_type, centroid_vector, p95_distance }
 */
export async function insertBaselineEmbeddingsBulk(client, baselineId, embeddings) {
    for (const emb of embeddings) {
        const vectorStr = `[${emb.centroid_vector.join(',')}]`;
        await client.query(
            `INSERT INTO baseline_probe_embeddings (baseline_id, probe_id, segment_type, centroid, p95_distance)
             VALUES ($1, $2, $3, $4::vector, $5)`,
            [baselineId, emb.probe_id, emb.embedding_type, vectorStr, emb.p95_distance]
        );
    }
}

/**
 * Bulk inserts feature baselines within a transaction.
 * @param {import('pg').PoolClient} client
 * @param {string} baselineId
 * @param {Object} featureBaselines - { probe_id: { feature_name: { median, mad, rate }, ... }, ... }
 */
export async function insertBaselineFeaturesBulk(client, baselineId, featureBaselines) {
    for (const [probeId, features] of Object.entries(featureBaselines)) {
        for (const [featureName, stats] of Object.entries(features)) {
            await client.query(
                `INSERT INTO baseline_probe_features (baseline_id, probe_id, feature_name, median, mad, rate)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [baselineId, probeId, featureName, stats.median ?? null, stats.mad ?? null, stats.rate ?? null]
            );
        }
    }
}

/**
 * Retrieves a baseline by ID and reconstructs the JSON structure expected by the drift engine.
 * @param {string} baselineId - baseline UUID
 * @returns {Promise<Object|null>} Baseline in drift-engine-compatible format
 */
export async function getBaselineById(baselineId) {
    const baseRes = await pool.query(
        `SELECT b.id, b.config_hash, b.probe_version, b.sample_size, b.created_at,
                m.name as model_name, m.provider
         FROM baselines b
         JOIN models m ON b.model_id = m.id
         WHERE b.id = $1`,
        [baselineId]
    );
    if (baseRes.rows.length === 0) return null;

    return _reconstructBaseline(baseRes.rows[0]);
}

/**
 * Retrieves the latest baseline for a given model config.
 * @param {string} modelId
 * @param {string} configHash
 * @param {string} probeVersion
 * @returns {Promise<Object|null>} Baseline in drift-engine-compatible format
 */
export async function getLatestBaseline(modelId, configHash, probeVersion) {
    const baseRes = await pool.query(
        `SELECT b.id, b.config_hash, b.probe_version, b.sample_size, b.created_at,
                m.name as model_name, m.provider
         FROM baselines b
         JOIN models m ON b.model_id = m.id
         WHERE b.model_id = $1 AND b.config_hash = $2 AND b.probe_version = $3
         ORDER BY b.created_at DESC
         LIMIT 1`,
        [modelId, configHash, probeVersion]
    );
    if (baseRes.rows.length === 0) return null;

    return _reconstructBaseline(baseRes.rows[0]);
}

/**
 * Internal: rebuilds the exact JSON shape expected by driftEngine.processDrift().
 */
async function _reconstructBaseline(row) {
    const baselineId = row.id;

    // 1. Load embedding baselines
    const embRes = await pool.query(
        `SELECT probe_id, segment_type, centroid::text, p95_distance
         FROM baseline_probe_embeddings
         WHERE baseline_id = $1`,
        [baselineId]
    );

    const embedding_baselines = embRes.rows.map(r => ({
        probe_id: r.probe_id,
        embedding_type: r.segment_type,
        centroid_vector: _parseVector(r.centroid),
        p95_distance: r.p95_distance
    }));

    // 2. Load feature baselines (grouped by probe_id)
    const featRes = await pool.query(
        `SELECT probe_id, feature_name, median, mad, rate
         FROM baseline_probe_features
         WHERE baseline_id = $1`,
        [baselineId]
    );

    const feature_baselines = {};
    for (const r of featRes.rows) {
        if (!feature_baselines[r.probe_id]) feature_baselines[r.probe_id] = {};
        feature_baselines[r.probe_id][r.feature_name] = {
            median: r.median,
            mad: r.mad,
            rate: r.rate
        };
    }

    return {
        baseline_id: baselineId,
        model_config: {
            provider: row.provider,
            model: row.model_name,
            temperature: 0.2,
            max_output_tokens: 4096,
            top_p: 0.95
        },
        probeset_version: row.probe_version,
        sample_size: row.sample_size,
        created_at: row.created_at,
        embedding_baselines,
        feature_baselines
    };
}

/**
 * Paginated list of baselines for API.
 */
export async function getPaginatedBaselines({ limit = 10, offset = 0 }) {
    const query = `
        SELECT b.id, b.config_hash, b.probe_version, b.sample_size, b.created_at,
               m.name as model_name, m.provider
        FROM baselines b
        JOIN models m ON b.model_id = m.id
        ORDER BY b.created_at DESC
        LIMIT $1 OFFSET $2
    `;
    const result = await pool.query(query, [limit, offset]);
    return result.rows;
}

/**
 * Count total baselines for pagination meta.
 */
export async function countBaselines() {
    const result = await pool.query(`SELECT COUNT(*) FROM baselines`);
    return parseInt(result.rows[0].count, 10);
}

/**
 * Parses a pgvector text representation "[0.1,0.2,...]" into a JS array.
 */
function _parseVector(vectorText) {
    return vectorText
        .replace('[', '')
        .replace(']', '')
        .split(',')
        .map(Number);
}
