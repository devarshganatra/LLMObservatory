/**
 * Stage 6: Drift Classifier (Decision H)
 * 
 * Classifies drift into INFO / WARNING / CRITICAL
 * based on probe-level and run-level scores.
 */

import { loadThresholds } from './config.js';

/**
 * Classifies the drift level for a run.
 * @param {string} driftState - "STABLE" | "PENDING" | "CONFIRMED"
 * @param {Object} runDecision - { drift_detected, trigger_reason, weighted_mean }
 * @param {Array<Object>} probeResults - Each with raw_probe_score
 * @returns {string} "INFO" | "WARNING" | "CRITICAL"
 */
export function classifyDrift(driftState, runDecision, probeResults) {
    const config = loadThresholds();

    // CRITICAL: confirmed drift or extreme anomaly
    if (driftState === 'CONFIRMED' || runDecision.trigger_reason === 'extreme_anomaly') {
        return 'CRITICAL';
    }

    // WARNING: pending drift or weighted mean above threshold
    if (driftState === 'PENDING' || runDecision.weighted_mean > config.WARNING_THRESHOLD) {
        return 'WARNING';
    }

    // INFO: any single probe above info threshold
    const anyProbeAboveInfo = probeResults.some(
        p => !p.system_error && p.raw_probe_score > config.INFO_THRESHOLD
    );
    if (anyProbeAboveInfo) {
        return 'INFO';
    }

    return 'INFO';  // Default classification for all runs
}
