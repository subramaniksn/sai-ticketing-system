-- Migration: Create Manager Notifications Table
-- Description: Tracks notifications sent by managers to dispatchers
-- Allows manager to see notification delivery, view status, and dispatcher responses

CREATE TABLE IF NOT EXISTS manager_notifications (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    manager_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    dispatcher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Notification content
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    
    -- Delivery tracking
    notification_status VARCHAR(50) NOT NULL DEFAULT 'sent' CHECK (notification_status IN ('sent', 'viewed', 'acknowledged', 'in_progress', 'completed', 'failed')),
    status_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Timestamps
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    viewed_at TIMESTAMP,
    acknowledged_at TIMESTAMP,
    
    -- Dispatcher response
    dispatcher_response TEXT,
    response_timestamp TIMESTAMP,
    
    -- Expected completion date for work
    expected_completion_date TIMESTAMP,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical'))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notifications_ticket ON manager_notifications(ticket_id);
CREATE INDEX IF NOT EXISTS idx_notifications_manager ON manager_notifications(manager_id);
CREATE INDEX IF NOT EXISTS idx_notifications_dispatcher ON manager_notifications(dispatcher_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON manager_notifications(notification_status);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON manager_notifications(sent_at);
CREATE INDEX IF NOT EXISTS idx_notifications_manager_status ON manager_notifications(manager_id, notification_status);

-- Create trigger to update status_updated_at when status changes
CREATE OR REPLACE FUNCTION update_notification_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.notification_status != OLD.notification_status THEN
        NEW.status_updated_at = CURRENT_TIMESTAMP;
        
        IF (NEW.notification_status = 'viewed' OR NEW.notification_status = 'acknowledged') 
           AND OLD.notification_status != 'viewed' 
           AND OLD.notification_status != 'acknowledged' THEN
            NEW.viewed_at = CURRENT_TIMESTAMP;
        END IF;
        
        IF NEW.notification_status = 'acknowledged' AND OLD.notification_status != 'acknowledged' THEN
            NEW.acknowledged_at = CURRENT_TIMESTAMP;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notification_status_timestamp_trigger ON manager_notifications;
CREATE TRIGGER notification_status_timestamp_trigger
BEFORE UPDATE ON manager_notifications
FOR EACH ROW
EXECUTE FUNCTION update_notification_status_timestamp();
