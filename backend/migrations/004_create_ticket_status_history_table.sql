-- Migration: Create Ticket Status History Table
-- Description: Tracks all status changes for audit trail and manager visibility
-- Helps manager see ticket progression and when status changed

CREATE TABLE IF NOT EXISTS ticket_status_history (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    
    -- Timestamp of change
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Additional context
    change_reason TEXT,
    comment_id INTEGER REFERENCES comments(id) ON DELETE SET NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_status_history_ticket ON ticket_status_history(ticket_id);
CREATE INDEX IF NOT EXISTS idx_status_history_changed_by ON ticket_status_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_status_history_changed_at ON ticket_status_history(changed_at);
CREATE INDEX IF NOT EXISTS idx_status_history_new_status ON ticket_status_history(new_status);
