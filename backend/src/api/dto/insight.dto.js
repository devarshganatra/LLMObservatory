/**
 * Insight DTO
 */
export function toInsightDTO(insightRun, probeEvents, systemEvents) {
    return {
        insight_run_id: insightRun.id,
        drift_run_id: insightRun.drift_run_id,
        summary: insightRun.summary,
        dominant_event: insightRun.dominant_event,
        confidence: insightRun.confidence,
        probe_events: probeEvents.map(e => ({
            probe_id: e.probe_id,
            event_type: e.event_type,
            confidence: e.confidence,
            metadata: e.metadata
        })),
        system_events: systemEvents.map(e => ({
            event_type: e.event_type,
            affected_probe_count: e.affected_probe_count,
            mean_confidence: e.mean_confidence
        }))
    };
}
