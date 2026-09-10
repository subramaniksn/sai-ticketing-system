-- Migration: Create Dispatcher Assignments Table
-- Description: Tracks dispatcher assignments, acceptance status, and history
-- Allows manager to see who is assigned and whether they accepted

CREATE TABLE IF NOT EXISTS dispatcher_assignments (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    assigned_by INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL, -- Manager who assigned
    dispatcher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Assigned dispatcher
    
    -- Assignment status tracking
    assignment_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (assignment_status IN ('pending', 'accepted', 'rejected', 'completed')),
    status_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Timestamps
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP,
    rejected_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Assignment context
    assignment_reason TEXT,
    expected_completion_date TIMESTAMP,
    
    -- Priority and notes
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    internal_notes TEXT
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_assignments_ticket ON dispatcher_assignments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_assignments_dispatcher ON dispatcher_assignments(dispatcher_id);
CREATE INDEX IF NOT EXISTS idx_assignments_assigned_by ON dispatcher_assignments(assigned_by);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON dispatcher_assignments(assignment_status);
CREATE INDEX IF NOT EXISTS idx_assignments_assigned_at ON dispatcher_assignments(assigned_at);
CREATE INDEX IF NOT EXISTS idx_assignments_dispatcher_status ON dispatcher_assignments(dispatcher_id, assignment_status);

-- Create trigger to update status_changed_at when status changes
CREATE OR REPLACE FUNCTION update_assignment_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.assignment_status != OLD.assignment_status THEN
        NEW.status_changed_at = CURRENT_TIMESTAMP;
        
        -- Auto-update accepted_at if status changed to accepted
        IF NEW.assignment_status = 'accepted' AND OLD.assignment_status != 'accepted' THEN
            NEW.accepted_at = CURRENT_TIMESTAMP;
        END IF;
        
        -- Auto-update rejected_at if status changed to rejected
        IF NEW.assignment_status = 'rejected' AND OLD.assignment_status != 'rejected' THEN
            NEW.rejected_at = CURRENT_TIMESTAMP;
        END IF;
        
        -- Auto-update completed_at if status changed to completed
        IF NEW.assignment_status = 'completed' AND OLD.assignment_status != 'completed' THEN
            NEW.completed_at = CURRENT_TIMESTAMP;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER assignment_status_timestamp_trigger
BEFORE UPDATE ON dispatcher_assignments
FOR EACH ROW
EXECUTE FUNCTION update_assignment_status_timestamp();
