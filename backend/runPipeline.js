import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import 'dotenv-flow/config';
import { logger } from './src/logger/logger.js';

// Repositories
import { updateRunStatus, getRunDetailsById } from './src/repositories/runRepository.js';
import { updateProbeFeatureVector } from './src/repositories/probeRepository.js';
import { getLatestBaseline } from './src/repositories/baselineRepository.js';
import { createModelIfNotExists } from './src/repositories/modelRepository.js';

// Services
import { runProbes } from './src/inference/runProbes.js';
import { persistRun } from './src/services/runService.js';
import { persistDriftResult } from './src/services/driftService.js';
import { persistInsightResult } from './src/services/insightService.js';

// Engines
import { extractFeatures } from './src/features/featureEngine.js';
import { processRunFile } from './src/embeddings/embeddingPipeline.js';
import { processDriftFromDB } from './src/drift/driftEngine.js';
import { processInsightsFromDB } from './src/insights/insightEngine.js';
import { probeMetadataMap } from './src/features/probeMetadata.js';

// Config
const DATA_DIR = path.resolve('../data');
const RUNS_DIR = path.join(DATA_DIR, 'runs');
const FEATURES_DIR = path.join(DATA_DIR, 'features');
const DRIFT_METRICS_DIR = path.join(DATA_DIR, 'drift_metrics');
const INSIGHTS_DIR = path.join(DATA_DIR, 'insights');

/**
 * Helper: Compute Model Config Hash
 */
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

/**
 * Helper: Baseline Guard (DB-only)
 */
async function ensureBaselineExists(runData) {
    const { model_config, probeset_version } = runData;

    // 1. Enforce temperature
    if (model_config.temperature !== 0.2) {
        throw new Error(`[ABORT] Invalid temperature: ${model_config.temperature}. Production runs must use 0.2.`);
    }

    // 2. Exact match check
    const configHash = computeConfigHash(model_config, probeset_version);
    const modelId = await createModelIfNotExists({
        name: model_config.model,
        provider: model_config.provider,
        version: null,
        configHash
    });

    const baseline = await getLatestBaseline(modelId, configHash, probeset_version);
    if (!baseline) {
        throw new Error(`[ABORT] No baseline found for model ${model_config.model} (${configHash}). Run baseline generation first.`);
    }

    logger.info({ baseline_id: baseline.baseline_id }, 'Baseline verified');
    return baseline;
}

/**
 * Main Pipeline Orchestrator
 */
export async function executePipeline({ runType = 'manual-api', temperatureOverride = 0.2, userId = null } = {}) {
    let dbRunId = null;
    const pipelineStart = process.hrtime.bigint();

    logger.info({ runType, temperatureOverride }, '🚀 [PIPELINE] Starting Production DB-Native Orchestration');

    try {
        // --- 1. INFERENCE ---
        const inferenceStart = process.hrtime.bigint();
        logger.debug('--- 1/8 Inference ---');
        const runData = await runProbes({ runType, temperatureOverride });
        const runId = runData.run_id; // original string ID
        const idOnly = runId.replace('run_', '');
        const inferenceDurationMs = Number((process.hrtime.bigint() - inferenceStart) / 1000000n);

        // --- 2. BASELINE GUARD ---
        const baseline = await ensureBaselineExists(runData);

        // --- 3. PERSIST RUN (INITIAL) ---
        logger.debug('--- 2/8 Persisting Run ---');
        const persistResult = await persistRun(runData, userId);
        dbRunId = persistResult.dbRunId;
        await updateRunStatus(dbRunId, { status: 'inference_complete' });

        // --- 4. FEATURE EXTRACTION ---
        const featureStart = process.hrtime.bigint();
        logger.debug('--- 3/8 Extracting & Persisting Features ---');
        const features = await extractFeatures(runData, probeMetadataMap);

        // Persist features to DB
        for (const probe of features.probe_results) {
            await updateProbeFeatureVector(dbRunId, probe.probe_id, probe.features);
        }

        // Optional JSON export
        if (!fs.existsSync(FEATURES_DIR)) fs.mkdirSync(FEATURES_DIR, { recursive: true });
        fs.writeFileSync(path.join(FEATURES_DIR, `features_${runId}.json`), JSON.stringify(features, null, 2));

        const featureDurationMs = Number((process.hrtime.bigint() - featureStart) / 1000000n);
        await updateRunStatus(dbRunId, { status: 'features_complete' });

        // --- 5. EMBEDDING GENERATION ---
        const embeddingStart = process.hrtime.bigint();
        logger.debug('--- 4/8 Generating & Syncing Embeddings ---');
        const runJsonPath = path.join(RUNS_DIR, `${runId}.json`);
        await processRunFile(runJsonPath);
        const embeddingDurationMs = Number((process.hrtime.bigint() - embeddingStart) / 1000000n);
        await updateRunStatus(dbRunId, { status: 'embeddings_complete' });

        // --- 6. DRIFT DETECTION (DB-NATIVE) ---
        const driftStart = process.hrtime.bigint();
        logger.debug('--- 5/8 Computing Drift (DB-Native) ---');
        const driftResult = await processDriftFromDB(dbRunId);
        const driftDurationMs = Number((process.hrtime.bigint() - driftStart) / 1000000n);

        // --- 7. DRIFT PERSISTENCE ---
        logger.debug('--- 6/8 Persisting Drift ---');
        const driftJsonPath = path.join(DRIFT_METRICS_DIR, `drift_${idOnly}.json`);
        const { driftRunId } = await persistDriftResult(driftResult, driftJsonPath, { dbRunId });
        await updateRunStatus(dbRunId, { status: 'drift_complete' });

        // --- 8. INSIGHT GENERATION (DB-NATIVE) ---
        const insightStart = process.hrtime.bigint();
        logger.debug('--- 7/8 Generating Insights (DB-Native) ---');
        const insightReport = await processInsightsFromDB(driftRunId);
        const insightDurationMs = Number((process.hrtime.bigint() - insightStart) / 1000000n);

        // --- 9. INSIGHT PERSISTENCE ---
        logger.debug('--- 8/8 Persisting Insights ---');
        const insightJsonPath = path.join(INSIGHTS_DIR, `insights_${idOnly}.json`);
        await persistInsightResult(insightReport, insightJsonPath, { dbRunId, driftRunId });

        // Finalize
        await updateRunStatus(dbRunId, { status: 'completed' });

        const pipelineDurationMs = Number((process.hrtime.bigint() - pipelineStart) / 1000000n);

        logger.info({
            run_id: runId,
            db_run_id: dbRunId,
            inference_duration_ms: inferenceDurationMs,
            feature_duration_ms: featureDurationMs,
            embedding_duration_ms: embeddingDurationMs,
            drift_duration_ms: driftDurationMs,
            insight_duration_ms: insightDurationMs,
            pipeline_duration_ms: pipelineDurationMs,
            drift_state: driftResult.run_decision.drift_state
        }, '✅ [PIPELINE] Execution Complete');

        return {
            run_id: runId,
            db_run_id: dbRunId,
            status: 'completed',
            pipeline_duration_ms: pipelineDurationMs
        };

    } catch (err) {
        logger.error({
            err,
            dbRunId,
            pipeline_duration_ms: Number((process.hrtime.bigint() - pipelineStart) / 1000000n)
        }, '❌ [PIPELINE] Failed');

        if (dbRunId) {
            await updateRunStatus(dbRunId, {
                status: 'failed',
                lastError: err.message,
                metadata: { stack: err.stack }
            }).catch(e => logger.error({ err: e }, '[FATAL] Could not update failed status'));
        }
        throw err;
    }
}

// CLI Support
if (process.argv[1]?.endsWith('runPipeline.js')) {
    const runType = process.argv[2] || 'manual-db';
    executePipeline({ runType }).catch(() => process.exit(1));
}
