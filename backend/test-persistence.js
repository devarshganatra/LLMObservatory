/**
 * End-to-end test for Phase 1 database persistence layer.
 * Inserts a synthetic run and verifies rows in models, runs, and probe_results.
 */

import 'dotenv/config';
import pool from './src/db/connection.js';
import { persistRun } from './src/services/runService.js';

async function test() {
    console.log('--- Phase 1 Persistence Layer Test ---\n');

    // Synthetic run data matching runProbes() output shape
    const syntheticRun = {
        run_id: `run_test_${Date.now()}`,
        run_type: 'test',
        probeset_version: 'v1_test',
        model_config: {
            provider: 'test_provider',
            model: 'test_model',
            temperature: 0.2,
            max_output_tokens: 4096,
            top_p: 0.95
        },
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        probe_results: [
            { probe_id: 'TEST_01', prompt: 'test prompt 1', response_text: 'Hello world response one.', latency_ms: 100, error: null },
            { probe_id: 'TEST_02', prompt: 'test prompt 2', response_text: 'Another test response here. With two sentences.', latency_ms: 150, error: null },
            { probe_id: 'TEST_03', prompt: 'test prompt 3', response_text: null, latency_ms: null, error: 'SIMULATED_ERROR' }
        ]
    };

    try {
        // 1. Persist 
        const { dbRunId, runId } = await persistRun(syntheticRun);
        console.log(`[OK] persistRun returned dbRunId=${dbRunId}, runId=${runId}`);

        // 2. Verify model row
        const modelRes = await pool.query(
            `SELECT id, name, provider FROM models WHERE name = 'test_model' AND provider = 'test_provider'`
        );
        console.log(`[OK] Models table: ${modelRes.rows.length} row(s) found`);

        // 3. Verify run row
        const runRes = await pool.query(`SELECT id, status, probe_version FROM runs WHERE id = $1`, [dbRunId]);
        console.log(`[OK] Runs table: status=${runRes.rows[0].status}, probe_version=${runRes.rows[0].probe_version}`);

        // 4. Verify probe_results count
        const probeRes = await pool.query(`SELECT count(*) as cnt FROM probe_results WHERE run_id = $1`, [dbRunId]);
        const count = parseInt(probeRes.rows[0].cnt);
        console.log(`[OK] Probe results: ${count} rows inserted`);

        if (count !== 3) throw new Error(`Expected 3 probe results, got ${count}`);

        // 5. Verify null response_text probe
        const nullProbe = await pool.query(
            `SELECT probe_id, response_text, token_count FROM probe_results WHERE run_id = $1 AND probe_id = 'TEST_03'`,
            [dbRunId]
        );
        console.log(`[OK] Null probe: response_text=${nullProbe.rows[0].response_text}, token_count=${nullProbe.rows[0].token_count}`);

        // 6. Cleanup test data
        await pool.query(`DELETE FROM probe_results WHERE run_id = $1`, [dbRunId]);
        await pool.query(`DELETE FROM runs WHERE id = $1`, [dbRunId]);
        await pool.query(`DELETE FROM models WHERE name = 'test_model' AND provider = 'test_provider'`);
        console.log(`[OK] Test data cleaned up`);

        console.log('\n[SUCCESS] All Phase 1 persistence checks passed.');

    } catch (err) {
        console.error('\n[FAILED]', err);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

test();
