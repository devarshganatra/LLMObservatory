/**
 * Stage 6: Segment Aggregator (Decision B)
 * 
 * Weighted combination of FULL/CODE/SAFETY segment scores.
 * Handles missing segments via weight renormalization.
 * Flags malformed responses as SYSTEM_ERROR.
 */

import { SEGMENT_WEIGHTS } from './config.js';

/**
 * Aggregates segment scores into a single embedding_score.
 * @param {{ full: number|null, code: number|null, safety: number|null }} segmentScores
 * @returns {{ embedding_score: number|null, system_error: boolean }}
 */
export function aggregateSegments(segmentScores) {
    const entries = Object.entries(SEGMENT_WEIGHTS)
        .filter(([type]) => segmentScores[type] !== null && segmentScores[type] !== undefined);

    // No active segments → SYSTEM_ERROR
    if (entries.length === 0) {
        return { embedding_score: null, system_error: true };
    }

    const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
    const weightedSum = entries.reduce((sum, [type, w]) => sum + w * segmentScores[type], 0);

    return {
        embedding_score: weightedSum / totalWeight,
        system_error: false
    };
}
