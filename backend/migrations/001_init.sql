-- =====================================================
-- EXTENSIONS
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- MODELS
-- =====================================================

CREATE TABLE IF NOT EXISTS models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    provider TEXT NOT NULL,
    version TEXT,
    config_hash TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_models_unique_config
ON models (name, provider, version, config_hash);

-- =====================================================
-- RUNS
-- =====================================================

CREATE TABLE IF NOT EXISTS runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    probe_version TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(model_id, started_at)
);

CREATE INDEX IF NOT EXISTS idx_runs_model ON runs(model_id);

-- =====================================================
-- PROBE RESULTS
-- =====================================================

CREATE TABLE IF NOT EXISTS probe_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    probe_id TEXT NOT NULL,
    response_text TEXT,
    token_count INT,
    sentence_count INT,
    feature_vector JSONB,
    embedding_full vector(1536),
    embedding_code vector(1536),
    embedding_safety vector(1536),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(run_id, probe_id)
);

CREATE INDEX IF NOT EXISTS idx_probe_results_run ON probe_results(run_id);

-- =====================================================
-- BASELINES
-- =====================================================

CREATE TABLE IF NOT EXISTS baselines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    config_hash TEXT NOT NULL,
    probe_version TEXT NOT NULL,
    sample_size INT NOT NULL CHECK (sample_size > 0),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(model_id, config_hash, probe_version, sample_size)
);

-- =====================================================
-- BASELINE PROBE EMBEDDINGS
-- =====================================================

CREATE TABLE IF NOT EXISTS baseline_probe_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    baseline_id UUID NOT NULL REFERENCES baselines(id) ON DELETE CASCADE,
    probe_id TEXT NOT NULL,
    segment_type TEXT NOT NULL CHECK (segment_type IN ('full', 'code', 'safety')),
    centroid vector(1536),
    p95_distance FLOAT NOT NULL CHECK (p95_distance >= 0),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(baseline_id, probe_id, segment_type)
);

CREATE INDEX IF NOT EXISTS idx_baseline_embeddings_baseline
ON baseline_probe_embeddings(baseline_id);

-- Optional vector index (can add later if needed)
-- CREATE INDEX idx_baseline_embeddings_vector
-- ON baseline_probe_embeddings
-- USING ivfflat (centroid vector_cosine_ops);

-- =====================================================
-- BASELINE PROBE FEATURES
-- =====================================================

CREATE TABLE IF NOT EXISTS baseline_probe_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    baseline_id UUID NOT NULL REFERENCES baselines(id) ON DELETE CASCADE,
    probe_id TEXT NOT NULL,
    feature_name TEXT NOT NULL,
    median FLOAT,
    mad FLOAT,
    rate FLOAT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(baseline_id, probe_id, feature_name)
);

CREATE INDEX IF NOT EXISTS idx_baseline_features_baseline
ON baseline_probe_features(baseline_id);

-- =====================================================
-- DRIFT RUNS
-- =====================================================

CREATE TABLE IF NOT EXISTS drift_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    baseline_id UUID NOT NULL REFERENCES baselines(id) ON DELETE CASCADE,
    drift_detected BOOLEAN NOT NULL,
    trigger_reason TEXT,
    weighted_mean FLOAT,
    classification TEXT CHECK (classification IN ('INFO', 'WARNING', 'CRITICAL')),
    drift_state TEXT CHECK (drift_state IN ('STABLE', 'PENDING', 'CONFIRMED')),
    confidence FLOAT CHECK (confidence >= 0),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drift_runs_run ON drift_runs(run_id);

-- =====================================================
-- DRIFT PROBE RESULTS
-- =====================================================

CREATE TABLE IF NOT EXISTS drift_probe_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drift_run_id UUID NOT NULL REFERENCES drift_runs(id) ON DELETE CASCADE,
    probe_id TEXT NOT NULL,
    embedding_score FLOAT,
    feature_score FLOAT,
    raw_probe_score FLOAT,
    final_probe_score FLOAT,
    volatility TEXT CHECK (volatility IN ('low', 'medium', 'high')),
    system_error BOOLEAN,
    segment_scores JSONB,
    cluster_scores JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(drift_run_id, probe_id)
);

CREATE INDEX IF NOT EXISTS idx_drift_probe_results_probe
ON drift_probe_results(probe_id);

CREATE INDEX IF NOT EXISTS idx_drift_probe_results_run
ON drift_probe_results(drift_run_id);

-- =====================================================
-- INSIGHT RUNS
-- =====================================================

CREATE TABLE IF NOT EXISTS insight_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    drift_run_id UUID NOT NULL REFERENCES drift_runs(id) ON DELETE CASCADE,
    summary TEXT,
    dominant_event TEXT,
    confidence FLOAT CHECK (confidence >= 0),
    consistency_hash TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insight_runs_run
ON insight_runs(run_id);

-- =====================================================
-- INSIGHT PROBE EVENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS insight_probe_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    insight_run_id UUID NOT NULL REFERENCES insight_runs(id) ON DELETE CASCADE,
    probe_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    confidence FLOAT CHECK (confidence >= 0),
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insight_probe_events_run
ON insight_probe_events(insight_run_id);

-- =====================================================
-- INSIGHT SYSTEM EVENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS insight_system_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    insight_run_id UUID NOT NULL REFERENCES insight_runs(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    affected_probe_count INT CHECK (affected_probe_count >= 0),
    mean_confidence FLOAT CHECK (mean_confidence >= 0),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insight_system_events_run
ON insight_system_events(insight_run_id);