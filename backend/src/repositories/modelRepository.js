/**
 * Model Repository — SQL-only data access layer
 */

import pool from '../db/connection.js';

/**
 * Creates a model record if it doesn't exist, returns the model ID.
 * Uses the unique index (name, provider, version, config_hash) for deduplication.
 * @param {Object} params
 * @param {import('pg').PoolClient} [client] - Optional transaction client
 * @returns {Promise<string>} model UUID
 */
export async function createModelIfNotExists({ name, provider, version, configHash }, client) {
    const conn = client || pool;

    // Use IS NOT DISTINCT FROM to handle NULL version correctly
    // (PostgreSQL treats NULL != NULL in standard comparisons)
    const result = await conn.query(
        `SELECT id FROM models
         WHERE name = $1 AND provider = $2 AND version IS NOT DISTINCT FROM $3 AND config_hash = $4`,
        [name, provider, version || null, configHash]
    );

    if (result.rows.length > 0) {
        return result.rows[0].id;
    }

    // Insert new model
    const insertResult = await conn.query(
        `INSERT INTO models (name, provider, version, config_hash)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [name, provider, version || null, configHash]
    );

    return insertResult.rows[0].id;
}
