-- Migration: Create Ticket Activity Log Table
-- Description: Comprehensive activity log for all ticket actions
-- Used by manager dashboard to show real-time updates and activity history

CREATE TABLE IF NOT EXISTS ticket_activity_log (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    
    -- Actor information
    actor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    actor_role VARCHAR(50), -- Cache of user role at time of action
    
    -- Activity details
    activity_type VARCHAR(100) NOT NULL,
    -- activity_type examples: 
    -- status_changed, comment_added, assigned_to_engineer, assigned_to_dispatcher,
    -- wait_customer_clicked, resolved_clicked, followup_added, notification_sent,
    -- assignment_accepted, assignment_rejected, escalation_updated
    
    activity_description TEXT,
    
    -- Related entities
    related_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- For assignment activities
    related_comment_id INTEGER REFERENCES comments(id) ON DELETE SET NULL,
    
    -- Changes tracking
    old_value VARCHAR(500), -- Previous value
    new_value VARCHAR(500), -- New value
    
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

-- Create a view for manager dashboard - Recent activities for assigned tickets
CREATE OR REPLACE VIEW manager_ticket_activities AS
SELECT 
    ta.id,
    ta.ticket_id,
    t.ticket_number,
    t.title,
    ta.activity_type,
    ta.activity_description,
    u_actor.full_name as actor_name,
    u_actor.role as actor_role,
    ta.created_at,
    CASE 
        WHEN ta.activity_type = 'status_changed' THEN CONCAT('Status changed from ', ta.old_value, ' to ', ta.new_value)
        WHEN ta.activity_type = 'comment_added' THEN 'New comment added'
        WHEN ta.activity_type = 'assigned_to_dispatcher' THEN CONCAT('Assigned to ', u_related.full_name)
        WHEN ta.activity_type = 'wait_customer_clicked' THEN 'Ticket placed on hold awaiting support'
        WHEN ta.activity_type = 'followup_added' THEN 'Daily follow-up comment added'
        ELSE ta.activity_description
    END as readable_activity
FROM ticket_activity_log ta
JOIN tickets t ON ta.ticket_id = t.id
JOIN users u_actor ON ta.actor_id = u_actor.id
LEFT JOIN users u_related ON ta.related_user_id = u_related.id
ORDER BY ta.created_at DESC;
