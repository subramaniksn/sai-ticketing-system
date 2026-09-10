-- Migration: Create Comments Table for Ticket Communication
-- Description: Adds comments table with public/private visibility control
-- Private comments are visible only to Engineer, Dispatcher, and Manager

CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    
    -- Comment content and type
    content TEXT NOT NULL,
    comment_type VARCHAR(50) NOT NULL DEFAULT 'public' CHECK (comment_type IN ('public', 'private')),
    
    -- Distinguish special comment types
    is_daily_followup BOOLEAN DEFAULT FALSE,
    is_resolution_comment BOOLEAN DEFAULT FALSE,
    is_escalation_comment BOOLEAN DEFAULT FALSE,
    
    -- Visibility control
    visible_to_customer BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    edited_at TIMESTAMP,
    edited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Tracking
    comment_reason VARCHAR(100),
    internal_notes TEXT
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_comments_ticket ON comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_comments_author ON comments(author_id);
CREATE INDEX IF NOT EXISTS idx_comments_type ON comments(comment_type);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);
CREATE INDEX IF NOT EXISTS idx_comments_is_daily_followup ON comments(is_daily_followup);
CREATE INDEX IF NOT EXISTS idx_comments_ticket_type ON comments(ticket_id, comment_type);

-- Create trigger to auto-hide private comments from customers
CREATE OR REPLACE FUNCTION auto_set_private_comment_visibility()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.comment_type = 'private' THEN
        NEW.visible_to_customer = FALSE;
    ELSE
        NEW.visible_to_customer = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS private_comment_visibility_trigger ON comments;
CREATE TRIGGER private_comment_visibility_trigger
BEFORE INSERT OR UPDATE ON comments
FOR EACH ROW
EXECUTE FUNCTION auto_set_private_comment_visibility();
