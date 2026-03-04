-- =====================================================
-- ADD 'processing' STATUS TO RUN LIFECYCLE
-- =====================================================

-- Drop old constraint
ALTER TABLE runs DROP CONSTRAINT IF EXISTS runs_status_check;

-- Add updated constraint with full lifecycle
-- Valid transitions (enforced in service layer):
--   pending → processing → completed | failed
ALTER TABLE runs ADD CONSTRAINT runs_status_check
CHECK (status IN (
    'pending',
    'processing',
    'inference_complete',
    'features_complete',
    'embeddings_complete',
    'drift_complete',
    'insights_complete',
    'completed',
    'failed'
));
