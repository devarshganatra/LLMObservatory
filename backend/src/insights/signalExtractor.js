/**
 * Stage 7: Layer 1 — Signal Extraction
 */

import { probeMetadataMap } from '../features/probeMetadata.js';

/**
 * Extracts normalized signal profiles from Stage 6 drift metrics.
 * @param {Object} driftData - The drift_metrics.json object
 * @returns {Array} List of SignalProfiles
 */
export function extractSignals(driftData) {
    const profiles = [];

    for (const probe of driftData.probe_results) {
        // Exclude probes with system errors
        if (probe.system_error) continue;

        const metadata = probeMetadataMap[probe.probe_id] || {};
        const details = probe.feature_details || {};

        profiles.push({
            probe_id: probe.probe_id,
            category: metadata.category || 'UNKNOWN',
            volatility: probe.volatility,
            probe_weight: probe.probe_weight,

            // Segment Scores
            seg_full: probe.segment_scores.full ?? 0,
            seg_code: probe.segment_scores.code ?? 0,
            seg_safety: probe.segment_scores.safety ?? 0,

            // Cluster Scores
            cl_structural: probe.cluster_scores.structural ?? 0,
            cl_guardrail: probe.cluster_scores.guardrail ?? 0,
            cl_tone: probe.cluster_scores.tone ?? 0,
            cl_semantic: probe.cluster_scores.semantic ?? 0,
            cl_compliance: probe.cluster_scores.compliance ?? 0,
            cl_identity: probe.cluster_scores.identity ?? 0,

            // Aggregate Scores
            embedding_score: probe.embedding_score,
            feature_score: probe.feature_score,
            raw_probe_score: probe.raw_probe_score,
            final_probe_score: probe.final_probe_score,

            // Directional Deltas
            delta_token_count: details.token_count?.delta ?? 0,
            delta_hedge_ratio: details.hedge_ratio?.delta ?? 0,
            delta_assertiveness_ratio: details.assertiveness_ratio?.delta ?? 0,
            delta_code_block_count: details.code_block_count?.delta ?? 0,
            delta_hard_refusal: details.hard_refusal?.delta ?? 0,
            delta_soft_refusal: details.soft_refusal?.delta ?? 0,

            // Baseline context for binary
            base_hard_refusal: details.hard_refusal?.baseline ?? 0,
            base_soft_refusal: details.soft_refusal?.baseline ?? 0
        });
    }

    return profiles;
}
