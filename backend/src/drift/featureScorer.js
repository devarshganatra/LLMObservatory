/**
 * Stage 6: Feature Drift Scorer (Decision C)
 * 
 * Numeric features: MAD-based normalization
 * Binary features: Rate-based scoring
 * Cluster-level aggregation with weighted combination
 */

import { CLUSTER_WEIGHTS, FEATURE_SCORE_CAP } from './config.js';

// ─── Feature Classification ──────────────────────────────────────────────
const BINARY_FEATURES = new Set([
    'hard_refusal', 'soft_refusal', 'compliance_with_warning',
    'dangerous_instruction_present', 'constraint_satisfied',
    'provider_name_detected', 'model_name_detected', 'cutoff_date_detected'
]);

const FEATURE_TO_CLUSTER = {
    token_count: 'STRUCTURAL',
    sentence_count: 'STRUCTURAL',
    line_count: 'STRUCTURAL',
    paragraph_count: 'STRUCTURAL',
    code_block_count: 'STRUCTURAL',
    avg_code_block_length: 'STRUCTURAL',
    code_density: 'STRUCTURAL',
    markdown_density: 'STRUCTURAL',
    hard_refusal: 'GUARDRAIL',
    soft_refusal: 'GUARDRAIL',
    compliance_with_warning: 'GUARDRAIL',
    dangerous_instruction_present: 'GUARDRAIL',
    hedge_ratio: 'TONE',
    assertiveness_ratio: 'TONE',
    moral_language_score: 'TONE',
    legal_reference_score: 'TONE',
    keyword_overlap_score: 'SEMANTIC',
    concept_coverage_score: 'SEMANTIC',
    constraint_satisfied: 'COMPLIANCE',
    sentence_violation_count: 'COMPLIANCE',
    provider_name_detected: 'IDENTITY',
    model_name_detected: 'IDENTITY',
    cutoff_date_detected: 'IDENTITY',
    limitation_count: 'IDENTITY'
};

/**
 * Computes drift score for a single numeric feature using MAD normalization.
 * @param {number} liveValue
 * @param {Object} baseline - { median, mad }
 * @returns {number} drift score ∈ [0, CAP]
 */
export function scoreNumericFeature(liveValue, baseline) {
    const { median, mad } = baseline;
    const scaledMad = mad * 1.4826;  // MAD-to-σ consistency constant

    if (scaledMad === 0) {
        return liveValue !== median ? FEATURE_SCORE_CAP : 0.0;
    }

    return Math.min(Math.abs(liveValue - median) / scaledMad, FEATURE_SCORE_CAP);
}

/**
 * Computes drift score for a single binary feature using baseline rate.
 * @param {boolean|number} liveValue - true/false or 1/0
 * @param {Object} baseline - { rate } (proportion of "true" in baseline)
 * @returns {number} drift score
 */
export function scoreBinaryFeature(liveValue, baseline) {
    const { rate } = baseline;
    const liveNumeric = liveValue ? 1 : 0;
    const denominator = Math.max(rate, 1 - rate, 0.05);

    return Math.min(Math.abs(liveNumeric - rate) / denominator, FEATURE_SCORE_CAP);
}

/**
 * Computes the full feature drift score for a probe.
 * @param {Object} liveFeatures - { feature_name: value, ... }
 * @param {Object} featureBaseline - { feature_name: { median, mad } or { rate }, ... }
 * @returns {{ feature_score: number, cluster_scores: Object }}
 */
export function computeFeatureScore(liveFeatures, featureBaseline) {
    // Group drift scores by cluster
    const clusterDrifts = {};
    for (const cluster of Object.keys(CLUSTER_WEIGHTS)) {
        clusterDrifts[cluster] = [];
    }

    for (const [name, liveValue] of Object.entries(liveFeatures)) {
        const cluster = FEATURE_TO_CLUSTER[name];
        if (!cluster) continue; // Unknown feature, skip

        const baseline = featureBaseline[name];
        if (!baseline) continue; // No baseline for this feature

        let drift;
        if (BINARY_FEATURES.has(name)) {
            drift = scoreBinaryFeature(liveValue, baseline);
        } else {
            drift = scoreNumericFeature(liveValue, baseline);
        }

        clusterDrifts[cluster].push(drift);
    }

    // Compute cluster-level scores
    const clusterScores = {};
    const featureDetails = {};
    let weightedSum = 0;
    let totalWeight = 0;

    for (const [cluster, drifts] of Object.entries(clusterDrifts)) {
        if (drifts.length === 0) {
            clusterScores[cluster.toLowerCase()] = 0;
            continue;
        }

        const clusterScore = drifts.reduce((a, b) => a + b, 0) / drifts.length;
        clusterScores[cluster.toLowerCase()] = Number(clusterScore.toFixed(6));

        const weight = CLUSTER_WEIGHTS[cluster];
        weightedSum += weight * clusterScore;
        totalWeight += weight;
    }

    // Capture directional details for Stage 7
    for (const [name, liveValue] of Object.entries(liveFeatures)) {
        const baseline = featureBaseline[name];
        if (!baseline) continue;

        const baselineVal = BINARY_FEATURES.has(name) ? (baseline.rate || 0) : (baseline.median || 0);
        const liveVal = typeof liveValue === 'boolean' ? (liveValue ? 1 : 0) : Number(liveValue);

        featureDetails[name] = {
            live: liveVal,
            baseline: baselineVal,
            delta: Number((liveVal - baselineVal).toFixed(6))
        };
    }

    const featureScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

    return {
        feature_score: Number(featureScore.toFixed(6)),
        cluster_scores: clusterScores,
        feature_details: featureDetails
    };
}
