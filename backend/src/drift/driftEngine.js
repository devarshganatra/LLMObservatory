import { computeSegmentScore, cosineDistance } from './segmentScorer.js';
import { aggregateSegments } from './segmentAggregator.js';
import { computeFeatureScore } from './featureScorer.js';
import { fuseProbeScores } from './probeFusion.js';
import { applyVolatilityWeight } from './volatilityWeighter.js';
import { computeRunDecision } from './runAggregator.js';
import { updateDriftState } from './persistenceEngine.js';
import { classifyDrift } from './driftClassifier.js';
import { getEmbeddingsByRunIds } from '../embeddings/qdrantService.js';
import { getRunDetailsById } from '../repositories/runRepository.js';
import { getProbeResultsByRunId } from '../repositories/probeRepository.js';
import { getLatestBaseline } from '../repositories/baselineRepository.js';
import { getLatestDriftRunByRunId } from '../repositories/driftRepository.js';
import { probeMetadataMap } from '../features/probeMetadata.js';
import { logger } from '../logger/logger.js';

/**
 * DB-Native Drift Detection.
 * Loads all context from Postgres and Qdrant.
 * @param {string} dbRunId - Run UUID
 */
export async function processDriftFromDB(dbRunId) {
    const start = process.hrtime.bigint();

    // 1. Load Run Details
    const run = await getRunDetailsById(dbRunId);
    if (!run) throw new Error(`Run not found: ${dbRunId}`);

    // 2. Load Probe Results
    const probeResultsRaw = await getProbeResultsByRunId(dbRunId);

    // 3. Load Baseline
    logger.debug({
        model_id: run.model_id,
        config_hash: run.config_hash,
        probe_version: run.probe_version
    }, '[DRIFT-DB] Looking for baseline');

    const baseline = await getLatestBaseline(run.model_id, run.config_hash, run.probe_version);
    if (!baseline) throw new Error(`Baseline not found for run ${dbRunId}`);

    // 4. Load Previous State
    const lastDrift = await getLatestDriftRunByRunId(dbRunId);
    const prevState = {
        state: lastDrift?.drift_state || 'STABLE',
        clean_count: lastDrift?.clean_count || 0
    };

    // 5. Fetch live embeddings from Qdrant
    const originalRunId = run.original_run_id;
    const points = await getEmbeddingsByRunIds([originalRunId]);
    const liveEmbs = {};
    for (const p of points) {
        if (!liveEmbs[p.payload.probe_id]) liveEmbs[p.payload.probe_id] = {};
        liveEmbs[p.payload.probe_id][p.payload.embedding_type] = p.vector;
    }

    const { embedding_baselines: embBaselines, feature_baselines: featBaselines } = baseline;
    const probeResults = [];

    // 6. Process each probe
    for (const probeRaw of probeResultsRaw) {
        const probeId = probeRaw.probe_id;
        const probeMeta = probeMetadataMap[probeId];
        const probeStart = process.hrtime.bigint();

        // Metadata fallback
        const volatility = probeMeta?.volatility || "medium";
        const weight = probeMeta?.weight || 1.0;

        // A. Segment Scoring
        const segmentScores = { full: null, code: null, safety: null };
        for (const type of ['full', 'code', 'safety']) {
            const liveVector = liveEmbs[probeId]?.[type];
            const embBaseline = embBaselines.find(b => b.probe_id === probeId && b.embedding_type === type);
            if (liveVector && embBaseline) {
                const distance = cosineDistance(liveVector, embBaseline.centroid_vector);
                segmentScores[type] = computeSegmentScore(distance, embBaseline.p95_distance);
            }
        }

        // B. Segment Aggregation
        const { embedding_score, system_error } = aggregateSegments(segmentScores);

        // C. Feature Scoring
        const liveFeatures = probeRaw.feature_vector || {};
        const featBaseline = featBaselines[probeId] || {};
        const { feature_score, cluster_scores, feature_details } = computeFeatureScore(liveFeatures, featBaseline);

        // D. Fusion
        const { raw_probe_score, system_error: fusionSystemError } = fuseProbeScores(embedding_score, feature_score);

        // E. Volatility Dampening
        const { final_probe_score, volatility_multiplier } = applyVolatilityWeight(raw_probe_score, volatility, weight);

        const probeDurationMs = Number((process.hrtime.bigint() - probeStart) / 1000000n);

        probeResults.push({
            probe_id: probeId,
            segment_scores: segmentScores,
            embedding_score,
            feature_score,
            cluster_scores,
            feature_details,
            raw_probe_score,
            final_probe_score,
            volatility,
            volatility_multiplier,
            probe_weight: weight,
            system_error: system_error || fusionSystemError,
            probe_duration_ms: probeDurationMs
        });
    }

    // F. Run-Level Aggregation
    const runDecision = computeRunDecision(probeResults);

    // G. Persistence (Temporal decision)
    const newState = updateDriftState(prevState.state, prevState.clean_count, runDecision);

    // H. Classification
    const classification = classifyDrift(newState.state, runDecision, probeResults);

    const driftDurationMs = Number((process.hrtime.bigint() - start) / 1000000n);

    logger.info({
        dbRunId,
        drift_duration_ms: driftDurationMs,
        drift_state: newState.state,
        classification
    }, 'Drift detection complete');

    // Assembly
    return {
        run_id: originalRunId,
        timestamp: run.started_at,
        probe_results: probeResults,
        run_decision: {
            ...runDecision,
            drift_state: newState.state,
            clean_count: newState.clean_count,
            classification
        },
        baseline_id: baseline.baseline_id,
        model_config_hash: baseline.config_hash,
        drift_duration_ms: driftDurationMs
    };
}

