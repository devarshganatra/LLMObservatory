/**
 * Stage 6: Run-Level Aggregator (Decision F)
 * 
 * Three-branch OR logic:
 * 1. Weighted global mean (uses final_probe_score)
 * 2. Low-volatility quorum (uses raw_probe_score)
 * 3. Extreme anomaly (uses raw_probe_score, excludes high-vol)
 */

import { loadThresholds } from './config.js';

/**
 * Computes the run-level drift decision across all probes.
 * @param {Array<Object>} probeResults - Each with: raw_probe_score, final_probe_score, volatility, volatility_multiplier, probe_weight, probe_id, system_error
 * @returns {Object} Run decision object
 */
export function computeRunDecision(probeResults) {
    const config = loadThresholds();

    // Exclude system errors from aggregation
    const validProbes = probeResults.filter(p => !p.system_error);
    const systemErrors = probeResults.filter(p => p.system_error).map(p => p.probe_id);

    if (validProbes.length === 0) {
        return {
            drift_detected: false,
            trigger_reason: 'none',
            weighted_mean: 0,
            low_vol_drifted: 0,
            max_non_high_vol_score: 0,
            system_errors: systemErrors
        };
    }

    // Branch 1: Weighted global mean (uses final_probe_score)
    const totalWeightedScore = validProbes.reduce((s, p) => s + p.final_probe_score, 0);
    const totalWeight = validProbes.reduce((s, p) => s + p.volatility_multiplier * p.probe_weight, 0);
    const weightedMean = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
    const globalDrift = weightedMean > config.GLOBAL_MEAN_THRESHOLD;

    // Branch 2: Low-volatility quorum (uses raw_probe_score)
    const lowVolProbes = validProbes.filter(p => p.volatility === 'low');
    const lowVolDrifted = lowVolProbes.filter(p => p.raw_probe_score > config.PROBE_DRIFT_THRESHOLD).length;
    const quorumDrift = lowVolDrifted >= config.LOW_VOL_QUORUM_COUNT;

    // Branch 3: Extreme anomaly (uses raw_probe_score, excludes high-vol)
    const nonHighVol = validProbes.filter(p => p.volatility !== 'high');
    const maxScore = nonHighVol.length > 0
        ? Math.max(...nonHighVol.map(p => p.raw_probe_score))
        : 0;
    const extremeDrift = maxScore > config.EXTREME_ANOMALY_THRESHOLD;

    // Priority: extreme > quorum > global
    const driftDetected = globalDrift || quorumDrift || extremeDrift;
    let triggerReason = 'none';
    if (extremeDrift) triggerReason = 'extreme_anomaly';
    else if (quorumDrift) triggerReason = 'low_vol_quorum';
    else if (globalDrift) triggerReason = 'global_mean';

    return {
        drift_detected: driftDetected,
        trigger_reason: triggerReason,
        weighted_mean: Number(weightedMean.toFixed(6)),
        low_vol_drifted: lowVolDrifted,
        max_non_high_vol_score: Number(maxScore.toFixed(6)),
        system_errors: systemErrors
    };
}
