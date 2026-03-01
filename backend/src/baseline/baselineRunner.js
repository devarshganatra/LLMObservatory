import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { runProbes } from '../inference/runProbes.js';
import { saveRun } from '../inference/saveRun.js';
import { extractFeatures } from '../features/featureEngine.js';
import { probeMetadataMap } from '../features/probeMetadata.js';
import { processRunFile } from '../embeddings/embeddingPipeline.js';
import { getEmbeddingsByRunIds } from '../embeddings/qdrantService.js';

const BASELINE_DIR = path.resolve('/Users/devarshganatra/Desktop/llmobservatory/data/baselines');
const RUNS_DIR = path.resolve('/Users/devarshganatra/Desktop/llmobservatory/data/runs');

/**
 * Generates a unique hash for a model configuration.
 */
function computeModelHash(config, probesetVersion) {
    const sortedConfig = {
        provider: config.provider,
        model: config.model,
        temperature: config.temperature,
        max_output_tokens: config.max_output_tokens,
        top_p: config.top_p,
        probeset_version: probesetVersion
    };
    return crypto.createHash('md5').update(JSON.stringify(sortedConfig)).digest('hex');
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Baseline Runner
 * Executes multiple runs to build a statistical baseline.
 */
export async function generateBaseline({ runs = 30 } = {}) {
    console.log(`[BASELINE] Starting baseline generation (${runs} runs)...`);

    if (!fs.existsSync(BASELINE_DIR)) {
        fs.mkdirSync(BASELINE_DIR, { recursive: true });
    }

    const runIds = [];
    let modelConfig = null;
    let probesetVersion = null;
    let totalEstimatedTokens = 0;

    for (let i = 1; i <= runs; i++) {
        console.log(`\n[BASELINE] --- Run ${i}/${runs} ---`);

        try {
            // 1. Run Probes with temperature 0.2
            const runData = await runProbes({
                temperatureOverride: 0.2,
                runType: "baseline"
            });

            if (!modelConfig) {
                modelConfig = runData.model_config;
                probesetVersion = runData.probeset_version;
            }

            // 2. Save Run
            saveRun(runData);
            runIds.push(runData.run_id);

            // 3. Estimate token usage
            const runTokens = runData.probe_results.reduce((sum, p) => sum + (p.response_text?.length || 0) / 4, 0);
            totalEstimatedTokens += runTokens;
            console.log(`[BASELINE] Run estimated tokens: ${Math.round(runTokens)}. Total: ${Math.round(totalEstimatedTokens)}`);

            if (totalEstimatedTokens > 1200000) {
                console.warn(`[WARNING] Token usage approaching 450K. Stopping early.`);
                break;
            }

            // 4. Trigger Stage 3 (Feature Extraction)
            const features = await extractFeatures(runData, probeMetadataMap);
            const featuresDir = path.resolve('/Users/devarshganatra/Desktop/llmobservatory/data/features');
            if (!fs.existsSync(featuresDir)) fs.mkdirSync(featuresDir, { recursive: true });
            const featuresPath = path.join(featuresDir, `features_${runData.run_id}.json`);
            fs.writeFileSync(featuresPath, JSON.stringify(features, null, 2));
            console.log(`[BASELINE] Stage 3 features saved: ${featuresPath}`);

            // 5. Trigger Stage 4 (Embedding Pipeline)
            const runFilePath = path.join(RUNS_DIR, `${runData.run_id}.json`);
            await processRunFile(runFilePath);

            // 6. Rate Limit Handling (5s between runs)
            if (i < runs) {
                console.log(`[BASELINE] Waiting 5 seconds before next run...`);
                await sleep(5000);
            }

        } catch (err) {
            console.error(`[ERROR] Run ${i} failed: ${err.message}`);
            // Retry once
            try {
                console.log(`[BASELINE] Retrying Run ${i}...`);
                const runData = await runProbes({ temperatureOverride: 0.2, runType: "baseline" });
                saveRun(runData);
                runIds.push(runData.run_id);
                const runFilePath = path.join(RUNS_DIR, `${runData.run_id}.json`);
                await processRunFile(runFilePath);
            } catch (retryErr) {
                console.error(`[CRITICAL] Retry for Run ${i} failed. Continuing...`);
            }
        }
    }

    if (runIds.length < 10) {
        throw new Error(`[ERROR] Baseline failed: sample_size (${runIds.length}) < 10`);
    }

    // --- Modeling Phase ---
    console.log(`\n[BASELINE] --- Beginning Modeling Phase ---`);
    const baseline = await computeBaselineStats(runIds, modelConfig, probesetVersion);

    const hash = computeModelHash(modelConfig, probesetVersion);
    const fileName = `baseline_${hash}.json`;
    const filePath = path.join(BASELINE_DIR, fileName);

    fs.writeFileSync(filePath, JSON.stringify(baseline, null, 2));

    console.log(`\n[SUCCESS] Baseline generation complete.`);
    console.log(`[SUCCESS] ${runIds.length} runs processed.`);
    console.log(`[SUCCESS] Baseline stored at: ${filePath}`);

    // Final Validation Output
    printBaselineSummary(baseline);

    return baseline;
}

/**
 * Computes centroid and distance statistics for each probe segment.
 */
async function computeBaselineStats(runIds, modelConfig, probesetVersion) {
    const points = await getEmbeddingsByRunIds(runIds);

    // Group by probe_id and embedding_type
    const groups = {};
    for (const point of points) {
        const key = `${point.payload.probe_id}|${point.payload.embedding_type}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(point.vector);
    }

    const probeBaselines = [];

    for (const [key, vectors] of Object.entries(groups)) {
        const [probe_id, embedding_type] = key.split('|');
        if (vectors.length < 10) continue;

        // 1. Centroid
        const dim = vectors[0].length;
        let centroid = new Array(dim).fill(0);
        for (const v of vectors) {
            for (let i = 0; i < dim; i++) {
                centroid[i] += v[i];
            }
        }
        for (let i = 0; i < dim; i++) {
            centroid[i] /= vectors.length;
        }

        // Normalize centroid
        const magnitude = Math.sqrt(centroid.reduce((sum, val) => sum + val * val, 0));
        centroid = centroid.map(val => val / magnitude);

        // 2. Distance Distribution
        const distances = vectors.map(v => {
            const similarity = v.reduce((sum, val, i) => sum + val * centroid[i], 0);
            return 1 - similarity;
        });

        distances.sort((a, b) => a - b);
        const mean = distances.reduce((sum, d) => sum + d, 0) / distances.length;
        const std = Math.sqrt(distances.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / distances.length);
        const p95 = distances[Math.floor(distances.length * 0.95)];

        probeBaselines.push({
            probe_id,
            embedding_type,
            centroid_vector: centroid,
            mean_distance: Number(mean.toFixed(6)),
            std_distance: Number(std.toFixed(6)),
            p95_distance: Number(p95.toFixed(6))
        });
    }

    return {
        baseline_id: `base_${Date.now()}`,
        model_config: modelConfig,
        probeset_version: probesetVersion,
        sample_size: runIds.length,
        created_at: new Date().toISOString(),
        probe_baselines: probeBaselines
    };
}

function printBaselineSummary(baseline) {
    const stds = baseline.probe_baselines.map(pb => pb.std_distance);
    const avgStd = stds.reduce((sum, s) => sum + s, 0) / stds.length;

    const sortedByStd = [...baseline.probe_baselines].sort((a, b) => a.std_distance - b.std_distance);
    const smallest = sortedByStd[0];
    const largest = sortedByStd[sortedByStd.length - 1];

    console.log(`\n--- Baseline Validation ---`);
    console.log(`Average std_distance across probes: ${avgStd.toFixed(6)}`);
    console.log(`Smallest std_distance: ${smallest.std_distance} (${smallest.probe_id} - ${smallest.embedding_type})`);
    console.log(`Largest std_distance: ${largest.std_distance} (${largest.probe_id} - ${largest.embedding_type})`);
    console.log(`---------------------------\n`);
}
