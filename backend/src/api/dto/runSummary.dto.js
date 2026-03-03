/**
 * Run Summary DTO
 */
export function toRunSummaryDTO(row) {
    return {
        run_id: row.id,
        status: row.status,
        model: row.model_name,
        started_at: row.started_at,
        probe_version: row.probe_version,
        drift_state: row.drift_state ?? 'STABLE',
        classification: row.classification ?? 'INFO',
        dominant_event: row.dominant_event ?? null
        // user_id hidden
    };
}
