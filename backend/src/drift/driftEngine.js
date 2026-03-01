/**
 * Stage 6: Drift Detection Orchestrator
 * 
 * Coordinates the full drift pipeline from raw run to final classification.
 */

import { computeSegmentScore, cosineDistance } from './segmentScorer.js';
import { aggregateSegments } from './segmentAggregator.js';
import { computeFeatureScore } from './featureScorer.js';
import { fuseProbeScores } from './probeFusion.js';
import { applyVolatilityWeight } from './volatilityWeighter.js';
import { computeRunDecision } from './runAggregator.js';
import { updateDriftState } from './persistenceEngine.js';
import { classifyDrift } from './driftClassifier.js';
import { getEmbeddingsByRunIds } from '../embeddings/qdrantService.js';

/**
 * Executes the full drift detection pipeline for a run.
 * @param {Object} runData - Raw run data from Stage 2
 * @param {Object} featuresData - Features data from Stage 3
 * @param {Object} baseline - Final baseline object
 * @param {Object} prevState - Current drift state (state, clean_count)
 * @returns {Object} Full drift result object
 */
export async function processDrift(runData, featuresData, baseline, prevState) {
    const { run_id, timestamp } = runData;
    const { embedding_baselines: embBaselines, feature_baselines: featBaselines } = baseline;

    // 1. Fetch live embeddings from Qdrant
    const points = await getEmbeddingsByRunIds([run_id]);
    const liveEmbs = {}; // probe_id -> { full: vector, ... }
    for (const p of points) {
        if (!liveEmbs[p.payload.probe_id]) liveEmbs[p.payload.probe_id] = {};
        liveEmbs[p.payload.probe_id][p.payload.embedding_type] = p.vector;
    }

    const probeResults = [];

    // 2. Process each probe
    for (const probeRes of runData.probe_results) {
        const probeId = probeRes.probe_id;
        const probeMeta = runData.probeset_version === baseline.probeset_version
            ? runData.probe_metadata?.[probeId]
            : null; // In production, we'd lookup from a stable registry

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
        const liveFeatures = featuresData.probe_results.find(p => p.probe_id === probeId)?.features || {};
        const featBaseline = featBaselines[probeId] || {};
        const { feature_score, cluster_scores, feature_details } = computeFeatureScore(liveFeatures, featBaseline);

        // D. Fusion
        const { raw_probe_score, system_error: fusionSystemError } = fuseProbeScores(embedding_score, feature_score);

        // E. Volatility Dampening
        const { final_probe_score, volatility_multiplier } = applyVolatilityWeight(raw_probe_score, volatility, weight);

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
            system_error: system_error || fusionSystemError
        });
    }

    // F. Run-Level Aggregation
    const runDecision = computeRunDecision(probeResults);

    // G. Persistence
    const newState = updateDriftState(prevState.state, prevState.clean_count, runDecision);

    // H. Classification
    const classification = classifyDrift(newState.state, runDecision, probeResults);

    // Assembly
    return {
        run_id,
        timestamp,
        probe_results: probeResults,
        run_decision: {
            ...runDecision,
            drift_state: newState.state,
            clean_count: newState.clean_count,
            classification
        },
        baseline_id: baseline.baseline_id,
        model_config_hash: baseline.model_config_hash // future-proofing
    };
}
