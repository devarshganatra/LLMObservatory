-- =====================================================
-- FIX: Add 'medium_high' to drift_probe_results.volatility CHECK
-- =====================================================

ALTER TABLE drift_probe_results
    DROP CONSTRAINT IF EXISTS drift_probe_results_volatility_check;

ALTER TABLE drift_probe_results
    ADD CONSTRAINT drift_probe_results_volatility_check
    CHECK (volatility IN ('low', 'medium', 'medium_high', 'high'));
