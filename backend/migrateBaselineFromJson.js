/**
 * Migration Script: baseline_final.json → PostgreSQL
 *
 * Reads the existing baseline JSON file and inserts it into the
 * baselines, baseline_probe_embeddings, and baseline_probe_features tables.
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pool from './src/db/connection.js';
import { createModelIfNotExists } from './src/repositories/modelRepository.js';
import { createBaseline, insertBaselineEmbeddingsBulk, insertBaselineFeaturesBulk } from './src/repositories/baselineRepository.js';

const BASELINE_PATH = path.resolve('../data/baselines/baseline_final.json');

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

async function migrate() {
    console.log('[MIGRATE] Reading baseline_final.json...');

    if (!fs.existsSync(BASELINE_PATH)) {
        console.error('[ERROR] Baseline file not found:', BASELINE_PATH);
        process.exit(1);
    }

    const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
    const { model_config, probeset_version, sample_size, embedding_baselines, feature_baselines } = baseline;

    console.log(`[MIGRATE] Baseline: sample_size=${sample_size}, embeddings=${embedding_baselines.length}, feature_probes=${Object.keys(feature_baselines).length}`);

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Ensure model exists
        const configHash = computeConfigHash(model_config, probeset_version);
        const modelId = await createModelIfNotExists({
            name: model_config.model,
            provider: model_config.provider,
            version: null,
            configHash
        }, client);
        console.log(`[MIGRATE] Model ID: ${modelId}`);

        // 2. Create baseline record
        const baselineId = await createBaseline({
            modelId,
            configHash,
            probeVersion: probeset_version,
            sampleSize: sample_size
        }, client);
        console.log(`[MIGRATE] Baseline ID: ${baselineId}`);

        // 3. Insert embedding baselines
        console.log(`[MIGRATE] Inserting ${embedding_baselines.length} embedding baselines...`);
        await insertBaselineEmbeddingsBulk(client, baselineId, embedding_baselines);

        // 4. Insert feature baselines
        const featureCount = Object.values(feature_baselines).reduce((sum, f) => sum + Object.keys(f).length, 0);
        console.log(`[MIGRATE] Inserting ${featureCount} feature baselines...`);
        await insertBaselineFeaturesBulk(client, baselineId, feature_baselines);

        await client.query('COMMIT');

        console.log(`\n[SUCCESS] Baseline migrated to PostgreSQL.`);
        console.log(`[SUCCESS] Baseline ID: ${baselineId}`);
        console.log(`[SUCCESS] Model ID: ${modelId}`);
        console.log(`[SUCCESS] Config Hash: ${configHash}`);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[FATAL] Migration failed, rolled back:', err.message);
        console.error(err.stack);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
