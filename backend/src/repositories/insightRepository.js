/**
 * Insight Repository — SQL-only data access layer
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
 * Creates a new insight_run record.
 * Must be called BEFORE inserting probe events or system events.
 *
 * @param {Object} params - Pre-computed insight result values
 * @param {string|null} params.runId - FK to runs(id), nullable during migration
 * @param {string|null} params.driftRunId - FK to drift_runs(id)
 * @param {string} params.summary - Human-readable insight summary
 * @param {string|null} params.dominantEvent - Top system event type
 * @param {number} params.confidence - Pre-computed run_confidence, raw float
 * @param {string} params.consistencyHash - SHA-256 hash
 * @param {import('pg').PoolClient} [client] - Optional transaction client
 * @returns {Promise<string>} insight_run UUID
 */
export async function createInsightRun(
    { runId, driftRunId, summary, dominantEvent, confidence, consistencyHash },
    client
) {
    const conn = client || pool;

    const result = await conn.query(
        `INSERT INTO insight_runs (run_id, drift_run_id, summary, dominant_event, confidence, consistency_hash)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
            runId || null,
            driftRunId || null,
            summary,
            dominantEvent || null,
            confidence,     // raw float, pre-computed
            consistencyHash
        ]
    );

    return result.rows[0].id;
}

/**
 * Bulk inserts insight probe events within a transaction.
 * Must be called AFTER createInsightRun returns insightRunId.
 *
 * Iterates probe_insights → events and flattens into rows.
 *
 * @param {import('pg').PoolClient} client - Transaction client (required)
 * @param {string} insightRunId - FK to insight_runs(id)
 * @param {Array<Object>} probeInsights - Array of probe insight objects from insightEngine
 */
export async function insertInsightProbeEventsBulk(client, insightRunId, probeInsights) {
    for (const probe of probeInsights) {
        for (const event of probe.events) {
            await client.query(
                `INSERT INTO insight_probe_events (insight_run_id, probe_id, event_type, confidence, metadata)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    insightRunId,
                    probe.probe_id,
                    event.event_type,
                    event.confidence,   // raw float
                    safeJsonb({
                        primary_signal: event.primary_signal || null,
                        primary_value: event.primary_value ?? null,
                        insight_severity: probe.insight_severity || null,
                        category: probe.category || null,
                        volatility: probe.volatility || null
                    })
                ]
            );
        }
    }
}

/**
 * Bulk inserts insight system events within a transaction.
 * Must be called AFTER createInsightRun returns insightRunId.
 *
 * @param {import('pg').PoolClient} client - Transaction client (required)
 * @param {string} insightRunId - FK to insight_runs(id)
 * @param {Array<Object>} systemEvents - Array from crossProbeAggregator output
 */
export async function insertInsightSystemEventsBulk(client, insightRunId, systemEvents) {
    for (const event of systemEvents) {
        await client.query(
            `INSERT INTO insight_system_events (insight_run_id, event_type, affected_probe_count, mean_confidence)
             VALUES ($1, $2, $3, $4)`,
            [
                insightRunId,
                event.event_type,
                event.affected_count,       // integer
                event.mean_confidence       // raw float
            ]
        );
    }
}
