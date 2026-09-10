-- Migration: Create Daily Followup Tracking Table
-- Description: Tracks daily follow-up compliance for tickets in "Wait Customer" state
-- After 7+ days in "Wait Customer", engineers must add daily follow-up comments

CREATE TABLE IF NOT EXISTS daily_followup_tracking (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    engineer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    
    -- Followup date tracking
    scheduled_date DATE NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    
    -- Comment reference
    comment_id INTEGER REFERENCES comments(id) ON DELETE SET NULL,
    
    -- Follow-up status
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'missed', 'overdue')),
    
    -- Alert tracking
    alert_sent BOOLEAN DEFAULT FALSE,
    alert_sent_to_manager BOOLEAN DEFAULT FALSE,
    manager_alerted_at TIMESTAMP,
    
    -- Compliance tracking
    days_waiting_at_followup INTEGER,
    support_status_update TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_followup_ticket ON daily_followup_tracking(ticket_id);
CREATE INDEX IF NOT EXISTS idx_followup_engineer ON daily_followup_tracking(engineer_id);
CREATE INDEX IF NOT EXISTS idx_followup_scheduled_date ON daily_followup_tracking(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_followup_status ON daily_followup_tracking(status);
CREATE INDEX IF NOT EXISTS idx_followup_completed ON daily_followup_tracking(completed);
CREATE INDEX IF NOT EXISTS idx_followup_alert_sent ON daily_followup_tracking(alert_sent_to_manager);
CREATE INDEX IF NOT EXISTS idx_followup_ticket_scheduled ON daily_followup_tracking(ticket_id, scheduled_date);

-- Create trigger to auto-update status based on completion
CREATE OR REPLACE FUNCTION update_followup_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.completed = TRUE AND OLD.completed = FALSE THEN
        NEW.status = 'completed';
        NEW.completed_at = CURRENT_TIMESTAMP;
    ELSIF NEW.completed = FALSE AND OLD.completed = TRUE THEN
        NEW.status = 'pending';
        NEW.completed_at = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS followup_status_update_trigger ON daily_followup_tracking;
CREATE TRIGGER followup_status_update_trigger
BEFORE UPDATE ON daily_followup_tracking
FOR EACH ROW
EXECUTE FUNCTION update_followup_status();
