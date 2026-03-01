/**
 * Stage 6: Volatility-Aware Dampening (Decision E)
 * 
 * final_probe_score = raw_probe_score × volatility_multiplier × probe_weight
 */

import { VOLATILITY_MULTIPLIERS } from './config.js';

/**
 * Applies volatility dampening and probe weight to a raw probe score.
 * @param {number} rawProbeScore
 * @param {string} volatility - "low" | "medium" | "medium_high" | "high"
 * @param {number} probeWeight - From probe definition (0.5–1.5)
 * @returns {{ final_probe_score: number, volatility_multiplier: number }}
 */
export function applyVolatilityWeight(rawProbeScore, volatility, probeWeight) {
    const multiplier = VOLATILITY_MULTIPLIERS[volatility] ?? 1.0;

    return {
        final_probe_score: Number((rawProbeScore * multiplier * probeWeight).toFixed(6)),
        volatility_multiplier: multiplier
    };
}
