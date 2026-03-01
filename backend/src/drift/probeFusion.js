/**
 * Stage 6: Probe-Level Fusion (Decision D)
 * 
 * raw_probe_score = (0.65 × embedding_score) + (0.35 × feature_score)
 */

import { FUSION_WEIGHTS } from './config.js';

/**
 * Fuses embedding and feature scores into a single probe-level score.
 * @param {number|null} embeddingScore - null if SYSTEM_ERROR
 * @param {number} featureScore
 * @returns {{ raw_probe_score: number, system_error: boolean }}
 */
export function fuseProbeScores(embeddingScore, featureScore) {
    // If embedding is null (SYSTEM_ERROR), use feature score only
    if (embeddingScore === null) {
        return {
            raw_probe_score: featureScore,
            system_error: true
        };
    }

    const raw = (FUSION_WEIGHTS.embedding * embeddingScore) +
        (FUSION_WEIGHTS.feature * featureScore);

    return {
        raw_probe_score: Number(raw.toFixed(6)),
        system_error: false
    };
}
