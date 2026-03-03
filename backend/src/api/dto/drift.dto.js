/**
 * Drift DTO
 */
export function toDriftDTO(driftRun, probeResults) {
    return {
        drift_run_id: driftRun.id,
        baseline_id: driftRun.baseline_id,
        drift_detected: driftRun.drift_detected,
        trigger_reason: driftRun.trigger_reason,
        weighted_mean: driftRun.weighted_mean,
        classification: driftRun.classification,
        drift_state: driftRun.drift_state,
        confidence: driftRun.confidence,
        probe_results: probeResults.map(p => ({
            probe_id: p.probe_id,
            embedding_score: p.embedding_score,
            feature_score: p.feature_score,
            raw_probe_score: p.raw_probe_score,
            final_probe_score: p.final_probe_score,
            volatility: p.volatility,
            system_error: p.system_error,
            segment_scores: p.segment_scores // assuming they are already cleaned up in Repo
        }))
    };
}
