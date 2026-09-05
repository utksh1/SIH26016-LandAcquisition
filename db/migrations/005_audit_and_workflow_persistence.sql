-- Migration: 005_audit_and_workflow_persistence.sql
-- Description: Unify audit logging, approval history, documents, and objections for end-to-end database persistence

BEGIN;

-- 1. Relax approval_history constraints to support all 11 statutory stakeholder roles and rich decisions
ALTER TABLE approval_history DROP CONSTRAINT IF EXISTS approval_history_actor_user_id_fkey;
ALTER TABLE approval_history ALTER COLUMN actor_role TYPE VARCHAR(64);
ALTER TABLE approval_history ALTER COLUMN decision TYPE VARCHAR(64);

-- 2. Relax audit_log actor constraints to support any user identity across systems
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_actor_user_id_fkey;
ALTER TABLE audit_log ALTER COLUMN actor_role TYPE VARCHAR(64);

-- 3. Relax document kind and signer constraints to accept all 15 stage document requirements
ALTER TABLE document DROP CONSTRAINT IF EXISTS document_signed_by_fkey;
ALTER TABLE document ALTER COLUMN kind TYPE VARCHAR(64);
ALTER TABLE document ALTER COLUMN signed_by TYPE TEXT;

-- 4. Enhance objection table for direct citizen portal submission and project-scoped lookups
ALTER TABLE objection ALTER COLUMN parcel_id DROP NOT NULL;
ALTER TABLE objection ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES project(id) ON DELETE CASCADE;
ALTER TABLE objection ADD COLUMN IF NOT EXISTS survey_number TEXT;
ALTER TABLE objection ADD COLUMN IF NOT EXISTS owner_name TEXT;
ALTER TABLE objection ADD COLUMN IF NOT EXISTS objection_type TEXT;
ALTER TABLE objection ADD COLUMN IF NOT EXISTS description TEXT;

COMMIT;
