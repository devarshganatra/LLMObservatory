ALTER TABLE runs
ADD COLUMN original_run_id TEXT UNIQUE;
-- this has been changed