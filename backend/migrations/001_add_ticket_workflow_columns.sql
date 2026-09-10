-- Migration: Add Ticket Status Workflow Columns
-- Description: Adds columns to existing tickets table to support status workflow
-- This migration adds columns without recreating the table

-- Add status workflow columns if they don't exist
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'created';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS status_changed_by INTEGER;

-- Add follow-up tracking columns
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS wait_customer_started_at TIMESTAMP;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS last_follow_up_at TIMESTAMP;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS days_in_wait_state INTEGER DEFAULT 0;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS requires_daily_followup BOOLEAN DEFAULT FALSE;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS followup_overdue BOOLEAN DEFAULT FALSE;

-- Add escalation columns
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS escalation_type VARCHAR(50);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS escalation_notes TEXT;

-- Add dispatcher assignment column
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS assigned_dispatcher_id INTEGER;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS manager_id INTEGER;

-- Add resolution tracking
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolution_comment TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolution_type VARCHAR(50);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_dispatcher ON tickets(assigned_dispatcher_id);
CREATE INDEX IF NOT EXISTS idx_tickets_manager ON tickets(manager_id);
CREATE INDEX IF NOT EXISTS idx_tickets_wait_customer_started ON tickets(wait_customer_started_at);
CREATE INDEX IF NOT EXISTS idx_tickets_requires_followup ON tickets(requires_daily_followup);

-- Add foreign key constraints if status_changed_by column was added
ALTER TABLE tickets ADD CONSTRAINT IF NOT EXISTS fk_tickets_status_changed_by 
  FOREIGN KEY (status_changed_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE tickets ADD CONSTRAINT IF NOT EXISTS fk_tickets_dispatcher 
  FOREIGN KEY (assigned_dispatcher_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE tickets ADD CONSTRAINT IF NOT EXISTS fk_tickets_manager 
  FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL;
