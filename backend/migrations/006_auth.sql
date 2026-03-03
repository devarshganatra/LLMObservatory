-- =====================================================
-- AUTHENTICATION & USER SCOPING
-- =====================================================

-- 1. Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    token_version INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2. Add user_id to runs (NULL initially for safe evolution)
ALTER TABLE runs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- 3. Add index for performance
CREATE INDEX IF NOT EXISTS idx_runs_user ON runs(user_id);
