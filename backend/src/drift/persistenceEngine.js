/**
 * Stage 6: Temporal Persistence Engine (Decision G)
 * 
 * States: STABLE → PENDING → CONFIRMED
 * Override: extreme_anomaly → immediately CONFIRMED
 * Recovery: 2 consecutive clean runs → STABLE
 */

import { loadThresholds } from './config.js';

/**
 * Updates the drift state based on the current run decision.
 * @param {string} currentState - "STABLE" | "PENDING" | "CONFIRMED"
 * @param {number} cleanCount - Consecutive clean runs since last drift
 * @param {Object} runDecision - { drift_detected, trigger_reason }
 * @returns {{ state: string, clean_count: number }}
 */
export function updateDriftState(currentState, cleanCount, runDecision) {
    const config = loadThresholds();
    const { drift_detected, trigger_reason } = runDecision;

    // Override: extreme anomaly bypasses PENDING
    if (drift_detected && trigger_reason === 'extreme_anomaly') {
        return { state: 'CONFIRMED', clean_count: 0 };
    }

    switch (currentState) {
        case 'STABLE':
            return drift_detected
                ? { state: 'PENDING', clean_count: 0 }
                : { state: 'STABLE', clean_count: 0 };

        case 'PENDING':
            return drift_detected
                ? { state: 'CONFIRMED', clean_count: 0 }
                : { state: 'STABLE', clean_count: 0 };

        case 'CONFIRMED':
            if (drift_detected) {
                return { state: 'CONFIRMED', clean_count: 0 };
            }
            const newCount = cleanCount + 1;
            return newCount >= config.CLEAN_RUNS_TO_RECOVER
                ? { state: 'STABLE', clean_count: 0 }
                : { state: 'CONFIRMED', clean_count: newCount };

        default:
            return { state: 'STABLE', clean_count: 0 };
    }
}
