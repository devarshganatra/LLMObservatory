/**
 * Stage 6: Segment Drift Scorer (Decision A)
 * 
 * segment_score = min(distance / p95, CAP)
 */

import { SEGMENT_SCORE_CAP } from './config.js';

/**
 * Computes cosine distance between a live vector and a baseline centroid.
 * @param {number[]} liveVector
 * @param {number[]} centroid
 * @returns {number} distance = 1 - cosine_similarity
 */
export function cosineDistance(liveVector, centroid) {
    let dot = 0;
    let magA = 0;
    let magB = 0;

    for (let i = 0; i < liveVector.length; i++) {
        dot += liveVector[i] * centroid[i];
        magA += liveVector[i] * liveVector[i];
        magB += centroid[i] * centroid[i];
    }

    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    if (denom === 0) return 1.0;

    const similarity = dot / denom;
    return 1 - similarity;
}

/**
 * Normalizes a cosine distance against the baseline p95 boundary.
 * @param {number} distance - Raw cosine distance
 * @param {number} p95 - 95th percentile distance from baseline
 * @returns {number} Normalized score ∈ [0, CAP]
 */
export function computeSegmentScore(distance, p95) {
    if (p95 === 0) {
        return distance > 0 ? SEGMENT_SCORE_CAP : 0.0;
    }
    return Math.min(distance / p95, SEGMENT_SCORE_CAP);
}
