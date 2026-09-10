-- Migration: Create Dashboard Views
-- Description: Optimized views for manager and dispatcher dashboards

-- View: Manager's ticket summary
CREATE OR REPLACE VIEW manager_ticket_summary AS
SELECT 
    t.id,
    t.ticket_number,
    t.title,
    t.status,
    t.priority,
    COALESCE(u_engineer.full_name, 'Unassigned') as engineer_name,
    COALESCE(u_dispatcher.full_name, 'Unassigned') as dispatcher_name,
    t.created_at,
    t.started_at,
    t.wait_customer_started_at,
    CASE 
        WHEN t.status = 'on_hold_awaiting_support' THEN 
            EXTRACT(DAY FROM CURRENT_TIMESTAMP - t.wait_customer_started_at)::INT
        ELSE NULL 
    END as days_waiting,
    t.requires_daily_followup,
    t.followup_overdue,
    t.escalation_type,
    (SELECT COUNT(*) FROM comments WHERE ticket_id = t.id AND comment_type = 'private') as private_comment_count,
    (SELECT COUNT(*) FROM daily_followup_tracking WHERE ticket_id = t.id AND completed = FALSE) as pending_followups,
    (SELECT MAX(created_at) FROM comments WHERE ticket_id = t.id) as last_comment_at,
    COALESCE(da.assignment_status, 'not_assigned') as dispatcher_assignment_status,
    da.assigned_at as dispatcher_assigned_at,
    da.accepted_at as dispatcher_accepted_at
FROM tickets t
LEFT JOIN users u_engineer ON t.assigned_engineer_id = u_engineer.id
LEFT JOIN users u_dispatcher ON t.assigned_dispatcher_id = u_dispatcher.id
LEFT JOIN dispatcher_assignments da ON t.id = da.ticket_id AND da.assignment_status != 'rejected'
ORDER BY t.updated_at DESC;

-- View: Manager notification status
CREATE OR REPLACE VIEW manager_notification_status AS
SELECT 
    mn.id,
    mn.ticket_id,
    t.ticket_number,
    t.title,
    u_manager.full_name as sent_by_manager,
    u_dispatcher.full_name as sent_to_dispatcher,
    mn.notification_status,
    mn.sent_at,
    mn.viewed_at,
    mn.acknowledged_at,
    CASE 
        WHEN mn.notification_status = 'sent' THEN 'Awaiting dispatcher view'
        WHEN mn.notification_status = 'viewed' THEN 'Dispatcher viewed - awaiting acknowledgment'
        WHEN mn.notification_status = 'acknowledged' THEN 'Dispatcher acknowledged'
        WHEN mn.notification_status = 'in_progress' THEN 'Work in progress'
        WHEN mn.notification_status = 'completed' THEN 'Work completed'
        ELSE 'Pending'
    END as status_text
FROM manager_notifications mn
JOIN tickets t ON mn.ticket_id = t.id
JOIN users u_manager ON mn.manager_id = u_manager.id
JOIN users u_dispatcher ON mn.dispatcher_id = u_dispatcher.id
ORDER BY mn.sent_at DESC;

-- View: Tickets requiring manager action
CREATE OR REPLACE VIEW manager_action_required AS
SELECT 
    t.id,
    t.ticket_number,
    t.title,
    'unassigned_dispatcher' as action_type,
    'Dispatcher not yet assigned' as action_reason,
    t.created_at as action_created_at
FROM tickets t
WHERE t.assigned_dispatcher_id IS NULL 
  AND t.status != 'resolved'
UNION ALL
SELECT 
    t.id,
    t.ticket_number,
    t.title,
    'dispatcher_not_accepted' as action_type,
    'Dispatcher assigned but not accepted' as action_reason,
    da.assigned_at as action_created_at
FROM tickets t
JOIN dispatcher_assignments da ON t.id = da.ticket_id
WHERE da.assignment_status = 'pending'
  AND t.status != 'resolved'
UNION ALL
SELECT 
    t.id,
    t.ticket_number,
    t.title,
    'followup_overdue' as action_type,
    CONCAT('Follow-up overdue by ', 
        EXTRACT(DAY FROM CURRENT_TIMESTAMP - t.wait_customer_started_at)::INT - 7, ' days') as action_reason,
    t.wait_customer_started_at as action_created_at
FROM tickets t
WHERE t.status = 'on_hold_awaiting_support'
  AND t.requires_daily_followup = TRUE
  AND t.followup_overdue = TRUE
ORDER BY action_created_at DESC;

-- View: Dispatcher assigned tickets
CREATE OR REPLACE VIEW dispatcher_assigned_tickets AS
SELECT 
    da.id as assignment_id,
    t.id,
    t.ticket_number,
    t.title,
    t.status,
    t.priority,
    da.assignment_status,
    COALESCE(u_engineer.full_name, 'Unassigned') as engineer_name,
    u_manager.full_name as assigned_by_manager,
    t.created_at,
    da.assigned_at,
    da.accepted_at,
    da.expected_completion_date,
    da.assignment_reason,
    (SELECT MAX(created_at) FROM comments WHERE ticket_id = t.id) as last_comment_at,
    (SELECT COUNT(*) FROM comments WHERE ticket_id = t.id AND comment_type = 'private') as private_comment_count
FROM dispatcher_assignments da
JOIN tickets t ON da.ticket_id = t.id
LEFT JOIN users u_engineer ON t.assigned_engineer_id = u_engineer.id
JOIN users u_manager ON da.assigned_by = u_manager.id
ORDER BY 
    CASE WHEN da.assignment_status = 'pending' THEN 1 ELSE 2 END,
    da.assigned_at DESC;
