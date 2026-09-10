-- Migration: Create Tickets Table
-- Description: Main tickets table with support for ticket status workflow
-- Status States: created, in_progress, on_hold_awaiting_support, resolved

CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    ticket_number VARCHAR(50) NOT NULL UNIQUE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    assigned_engineer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_dispatcher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Ticket Status Workflow
    status VARCHAR(50) NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'in_progress', 'on_hold_awaiting_support', 'resolved')),
    status_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status_changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Tracking dates
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    resolved_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Follow-up tracking for long-waiting tickets
    wait_customer_started_at TIMESTAMP,
    last_follow_up_at TIMESTAMP,
    days_in_wait_state INTEGER DEFAULT 0,
    requires_daily_followup BOOLEAN DEFAULT FALSE,
    followup_overdue BOOLEAN DEFAULT FALSE,
    
    -- Support escalation tracking
    escalation_type VARCHAR(50) CHECK (escalation_type IN ('site_team', 'internal_team', 'vendor', NULL)),
    escalation_notes TEXT,
    
    -- Priority and categorization
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    category VARCHAR(100),
    
    -- Resolution tracking
    resolution_comment TEXT,
    resolution_type VARCHAR(50) CHECK (resolution_type IN ('resolved', 'closed', 'wont_fix', NULL))
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_engineer ON tickets(assigned_engineer_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_dispatcher ON tickets(assigned_dispatcher_id);
CREATE INDEX IF NOT EXISTS idx_tickets_manager ON tickets(manager_id);
CREATE INDEX IF NOT EXISTS idx_tickets_requester ON tickets(requester_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_wait_customer_started ON tickets(wait_customer_started_at);
CREATE INDEX IF NOT EXISTS idx_tickets_requires_followup ON tickets(requires_daily_followup);
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_number ON tickets(ticket_number);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tickets_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tickets_timestamp_trigger
BEFORE UPDATE ON tickets
FOR EACH ROW
EXECUTE FUNCTION update_tickets_timestamp();

-- Create trigger to update status_changed_at when status changes
CREATE OR REPLACE FUNCTION update_ticket_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status != OLD.status THEN
        NEW.status_changed_at = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ticket_status_timestamp_trigger
BEFORE UPDATE ON tickets
FOR EACH ROW
EXECUTE FUNCTION update_ticket_status_timestamp();
