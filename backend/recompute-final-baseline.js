import fs from 'fs';
import path from 'path';
import { getEmbeddingsByRunIds } from './src/embeddings/qdrantService.js';
import { median, mad, calculateRate } from './src/baseline/stats.js';

const RUNS_DIR = path.resolve('../data/runs');
const FEATURES_DIR = path.resolve('../data/features');
const BASELINE_DIR = path.resolve('../data/baselines');

async function recomputeFinalBaseline() {
    console.log('[BASELINE] Starting final re-computation across all runs...');

    const runFiles = fs.readdirSync(RUNS_DIR).filter(f => f.startsWith('run_') && f.endsWith('.json'));
    const runs = runFiles.map(f => {
        try {
            return JSON.parse(fs.readFileSync(path.join(RUNS_DIR, f), 'utf8'));
        } catch (err) {
            console.error(`[ERROR] Failed to read ${f}: ${err.message}`);
            return null;
        }
    }).filter(Boolean);

    console.log(`[BASELINE] Found ${runs.length} runs in total.`);

    // Group runs by model/temp/top_p to find the primary baseline candidate
    const configGroups = {};
    for (const run of runs) {
        const config = run.model_config;
        const key = `${config.model}|t${config.temperature}|p${config.top_p}`;
        if (!configGroups[key]) configGroups[key] = [];
        configGroups[key].push(run);
    }

    // Pick the largest group (should be qwen temp 0.2)
    const sortedKeys = Object.keys(configGroups).sort((a, b) => configGroups[b].length - configGroups[a].length);
    const mainKey = sortedKeys[0];
    const mainRuns = configGroups[mainKey];

    console.log(`[BASELINE] Using primary config group: ${mainKey} (${mainRuns.length} runs)`);

    const runIds = mainRuns.map(r => r.run_id);
    const modelConfig = mainRuns[0].model_config;
    const probesetVersion = mainRuns[0].probeset_version;

    // 1. Compute Embedding Baselines
    console.log(`[BASELINE] Fetching embeddings for ${runIds.length} runs...`);
    const points = await getEmbeddingsByRunIds(runIds);
    const embGroups = {};
    for (const point of points) {
        const key = `${point.payload.probe_id}|${point.payload.embedding_type}`;
        if (!embGroups[key]) embGroups[key] = [];
        embGroups[key].push(point.vector);
    }

    const probeEmbeddingBaselines = [];
    for (const [key, vectors] of Object.entries(embGroups)) {
        if (vectors.length < 10) continue;
        const [probe_id, embedding_type] = key.split('|');

        // Centroid
        const dim = vectors[0].length;
        let centroid = new Array(dim).fill(0);
        for (const v of vectors) {
            for (let i = 0; i < dim; i++) centroid[i] += v[i];
        }
        for (let i = 0; i < dim; i++) centroid[i] /= vectors.length;

        // Normalization
        const magnitude = Math.sqrt(centroid.reduce((sum, val) => sum + val * val, 0));
        const normalizedCentroid = centroid.map(val => val / magnitude);

        // p95
        const distances = vectors.map(v => {
            const similarity = v.reduce((sum, val, i) => sum + val * normalizedCentroid[i], 0);
            return 1 - similarity;
        }).sort((a, b) => a - b);
        const p95 = distances[Math.floor(distances.length * 0.95)];

        probeEmbeddingBaselines.push({
            probe_id,
            embedding_type,
            centroid_vector: normalizedCentroid,
            p95_distance: Number(p95.toFixed(6))
        });
    }

    // 2. Compute Feature Baselines
    console.log(`[BASELINE] Processing features for ${runIds.length} runs...`);
    const featureGroups = {}; // key: probe_id|feature_name, value: Array<values>

    for (const runId of runIds) {
        // Handle run_ prefix if already present in runId
        const idOnly = runId.startsWith('run_') ? runId.replace('run_', '') : runId;
        const featurePath = path.join(FEATURES_DIR, `features_run_${idOnly}.json`);
        if (!fs.existsSync(featurePath)) continue;

        const featureData = JSON.parse(fs.readFileSync(featurePath, 'utf8'));
        for (const probeRes of featureData.probe_results) {
            const probeId = probeRes.probe_id;
            for (const [featureName, val] of Object.entries(probeRes.features)) {
                const key = `${probeId}|${featureName}`;
                if (!featureGroups[key]) featureGroups[key] = [];
                featureGroups[key].push(val);
            }
        }
    }

    const probeFeatureBaselines = {}; // probe_id -> { feature_name: { median, mad, rate } }
    for (const [key, values] of Object.entries(featureGroups)) {
        if (values.length < 10) continue;
        const [probeId, featureName] = key.split('|');
        if (!probeFeatureBaselines[probeId]) probeFeatureBaselines[probeId] = {};

        const med = median(values);
        const m = mad(values, med);
        const rate = calculateRate(values);

        probeFeatureBaselines[probeId][featureName] = {
            median: Number(med.toFixed(6)),
            mad: Number(m.toFixed(6)),
            rate: Number(rate.toFixed(6))
        };
    }

    // 3. Assemble Final Object
    const finalBaseline = {
        baseline_id: `final_solid_${Date.now()}`,
        model_config: modelConfig,
        probeset_version: probesetVersion,
        sample_size: runIds.length,
        created_at: new Date().toISOString(),
        embedding_baselines: probeEmbeddingBaselines,
        feature_baselines: probeFeatureBaselines
    };

    const filePath = path.join(BASELINE_DIR, 'baseline_final.json');
    fs.writeFileSync(filePath, JSON.stringify(finalBaseline, null, 2));

    console.log(`\n[SUCCESS] Final Solid Baseline saved to: ${filePath}`);
    console.log(`[SUCCESS] Aggregated ${runIds.length} runs.`);
}

recomputeFinalBaseline().catch(err => {
    console.error(`[FATAL] ${err.stack}`);
    process.exit(1);
});
