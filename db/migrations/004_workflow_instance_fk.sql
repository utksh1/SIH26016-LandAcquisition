-- Migration: 004_workflow_instance_fk.sql
-- Description: Link workflow_instance.current_stage to workflow_stage_definition(stage_code) for all 15 legal stages

ALTER TABLE workflow_instance DROP CONSTRAINT IF EXISTS workflow_instance_current_stage_fkey;
UPDATE workflow_instance SET current_stage = 'land_record_verification' WHERE current_stage = 'land_verification_nh';
ALTER TABLE workflow_instance ADD CONSTRAINT workflow_instance_current_stage_fkey FOREIGN KEY (current_stage) REFERENCES workflow_stage_definition(stage_code);
