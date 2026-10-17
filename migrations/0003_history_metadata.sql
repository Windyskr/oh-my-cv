ALTER TABLE resumes ADD COLUMN source_id TEXT;
ALTER TABLE resume_history ADD COLUMN changes TEXT NOT NULL DEFAULT '["name","markdown","css","styles"]';
ALTER TABLE resume_history ADD COLUMN restored_from TEXT;
ALTER TABLE resume_history ADD COLUMN original_id TEXT;
