-- Migration: Create Ticket Activity Log Table
-- Description: Comprehensive activity log for all ticket actions
-- Used by manager dashboard to show real-time updates and activity history

CREATE TABLE IF NOT EXISTS ticket_activity_log (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    
    -- Actor information
    actor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    actor_role VARCHAR(50),
    
    -- Activity details
    activity_type VARCHAR(100) NOT NULL,
    activity_description TEXT,
    
    -- Related entities
    related_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    related_comment_id INTEGER REFERENCES comments(id) ON DELETE SET NULL,
    
    -- Changes tracking
    old_value VARCHAR(500),
    new_value VARCHAR(500),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Additional context
    ip_address VARCHAR(50),
    user_agent VARCHAR(500)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_activity_log_ticket ON ticket_activity_log(ticket_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_actor ON ticket_activity_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_type ON ticket_activity_log(activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON ticket_activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_log_ticket_created ON ticket_activity_log(ticket_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_log_related_user ON ticket_activity_log(related_user_id);
