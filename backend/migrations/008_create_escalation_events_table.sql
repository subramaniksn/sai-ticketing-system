-- Migration: Create Escalation Events Table
-- Description: Tracks when tickets are escalated to Site Team, Internal Team, or Vendor
-- Manager can see escalation history and current escalation status

CREATE TABLE IF NOT EXISTS escalation_events (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    
    -- Escalation details
    escalated_by INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    escalation_type VARCHAR(50) NOT NULL CHECK (escalation_type IN ('site_team', 'internal_team', 'vendor')),
    
    -- Escalation context
    escalation_reason TEXT NOT NULL,
    required_support_detail TEXT,
    
    -- Resolution tracking
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP,
    resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    
    -- Timestamps
    escalated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expected_resolution_date TIMESTAMP,
    
    -- Status tracking
    escalation_status VARCHAR(50) NOT NULL DEFAULT 'in_progress' CHECK (escalation_status IN ('in_progress', 'waiting_for_response', 'resolved', 'escalated_further')),
    last_status_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Additional tracking
    escalation_reference_number VARCHAR(100),
    external_contact_id VARCHAR(100),
    notes TEXT
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_escalation_ticket ON escalation_events(ticket_id);
CREATE INDEX IF NOT EXISTS idx_escalation_escalated_by ON escalation_events(escalated_by);
CREATE INDEX IF NOT EXISTS idx_escalation_type ON escalation_events(escalation_type);
CREATE INDEX IF NOT EXISTS idx_escalation_status ON escalation_events(escalation_status);
CREATE INDEX IF NOT EXISTS idx_escalation_escalated_at ON escalation_events(escalated_at);
CREATE INDEX IF NOT EXISTS idx_escalation_resolved ON escalation_events(resolved);
CREATE INDEX IF NOT EXISTS idx_escalation_ticket_status ON escalation_events(ticket_id, escalation_status);

-- Create trigger to update last_status_update when status changes
CREATE OR REPLACE FUNCTION update_escalation_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.escalation_status != OLD.escalation_status THEN
        NEW.last_status_update = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS escalation_status_timestamp_trigger ON escalation_events;
CREATE TRIGGER escalation_status_timestamp_trigger
BEFORE UPDATE ON escalation_events
FOR EACH ROW
EXECUTE FUNCTION update_escalation_status_timestamp();
