-- =====================================================
-- RUN LIFECYCLE STATUS UPDATE
-- =====================================================

-- 1. Drop old constraint
ALTER TABLE runs DROP CONSTRAINT IF EXISTS runs_status_check;

-- 2. Add new constraint with granular statuses
ALTER TABLE runs ADD CONSTRAINT runs_status_check 
CHECK (status IN (
    'pending', 
    'inference_complete', 
    'features_complete', 
    'embeddings_complete', 
    'drift_complete', 
    'insights_complete', 
    'completed', 
    'failed'
));

-- 3. Add last_error column for debugging pipeline failures
ALTER TABLE runs ADD COLUMN IF NOT EXISTS last_error TEXT;
