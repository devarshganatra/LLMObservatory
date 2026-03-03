/**
 * Run Detail DTO
 */
export function toRunDetailDTO(runRow, driftRow, insightRow) {
    return {
        run_id: runRow.id,
        status: runRow.status,
        model: runRow.model_name,
        provider: runRow.provider,
        probe_version: runRow.probe_version,
        started_at: runRow.started_at,
        completed_at: runRow.completed_at,
        // user_id hidden
        metadata: runRow.metadata || {},
        drift: driftRow ? {
            drift_detected: driftRow.drift_detected,
            trigger_reason: driftRow.trigger_reason,
            weighted_mean: driftRow.weighted_mean,
            classification: driftRow.classification,
            drift_state: driftRow.drift_state,
            confidence: driftRow.confidence
        } : null,
        insight: insightRow ? {
            summary: insightRow.summary,
            dominant_event: insightRow.dominant_event,
            confidence: insightRow.confidence
        } : null
    };
}
