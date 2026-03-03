/**
 * Baseline DTO
 */
export function toBaselineSummaryDTO(row) {
    return {
        baseline_id: row.id,
        model: row.model_name,
        provider: row.provider,
        sample_size: row.sample_size,
        probe_version: row.probe_version,
        created_at: row.created_at
    };
}

export function toBaselineDetailDTO(row) {
    return {
        baseline_id: row.id,
        model: row.model_name,
        provider: row.provider,
        config_hash: row.config_hash,
        probe_version: row.probe_version,
        sample_size: row.sample_size,
        created_at: row.created_at,
        // Detailed probe metrics could be added here if needed
        probe_count: row.feature_baselines ? Object.keys(row.feature_baselines).length : 0
    };
}
