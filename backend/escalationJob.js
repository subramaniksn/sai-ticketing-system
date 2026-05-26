// backend/escalationJob.js
// ✅ Cron job: 20-min reminder + SLA escalation via WhatsApp (Baileys)

const cron = require('node-cron');
const pool = require('./db');
const {
  notifyEngineerReminder,
  notifyManagerSlaBreached
} = require('./whatsappService');

// ─── Helpers ─────────────────────────────────────────────────────────────────
const toIst = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour12: true,
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
};

// ─── 20-min Reminder ─────────────────────────────────────────────────────────
const checkReminders = async () => {
  try {
    // Tickets still 'Open', created > 20 min ago, reminder NOT yet sent
    const { rows } = await pool.query(`
      SELECT
        t."TicketID", t."TicketNo", t."CustomerName", t."SiteName",
        t."IssueDetails", t."priority", t."CreatedTime",
        u."Email" AS "EngineerEmail",
        u."Phone" AS "EngineerPhone"
      FROM public."Tickets" t
      JOIN public."Users" u ON u."Email" = t."AssignedTo"
      WHERE
        t."Status" = 'Open'
        AND t."ReminderSent" = false
        AND t."CreatedTime" <= NOW() - INTERVAL '20 minutes'
    `);

    for (const ticket of rows) {
      const engineerName = ticket.EngineerEmail.split('@')[0];
      console.log(`⏰ 20-min reminder → ${ticket.TicketNo} | ${ticket.EngineerEmail}`);

      await notifyEngineerReminder(
        ticket.EngineerPhone,
        engineerName,
        {
          ticketNo:     ticket.TicketNo,
          customerName: ticket.CustomerName,
          siteName:     ticket.SiteName,
          priority:     ticket.priority
        }
      );

      // Mark so it won't fire again
      await pool.query(
        `UPDATE public."Tickets" SET "ReminderSent" = true WHERE "TicketID" = $1`,
        [ticket.TicketID]
      );
    }

    if (rows.length > 0) console.log(`✅ Sent ${rows.length} reminder(s)`);

  } catch (err) {
    console.error('❌ Reminder check error:', err.message);
  }
};

// ─── SLA Escalation ──────────────────────────────────────────────────────────
const checkEscalations = async () => {
  try {
    // Tickets not resolved, SLA breached, escalation NOT yet sent
    // Cross joins with ALL managers so each manager gets notified
    const { rows } = await pool.query(`
      SELECT
        t."TicketID", t."TicketNo", t."CustomerName", t."SiteName",
        t."IssueDetails", t."priority", t."CreatedTime", t."Status",
        u."Email"  AS "EngineerEmail",
        u."Phone"  AS "EngineerPhone",
        m."Email"  AS "ManagerEmail",
        m."Phone"  AS "ManagerPhone"
      FROM public."Tickets" t
      JOIN public."Users" u ON u."Email" = t."AssignedTo"
      CROSS JOIN (
        SELECT "Email", "Phone" FROM public."Users" WHERE "Role" = 'Manager'
      ) m
      WHERE
        t."Status" NOT IN ('Resolved')
        AND t."EscalationSent" = false
        AND (
          (t."priority" = 'High'   AND t."CreatedTime" <= NOW() - INTERVAL '2 hours')  OR
          (t."priority" = 'Medium' AND t."CreatedTime" <= NOW() - INTERVAL '8 hours')  OR
          (t."priority" = 'Low'    AND t."CreatedTime" <= NOW() - INTERVAL '24 hours')
        )
    `);

    const escalatedIds = new Set();

    for (const ticket of rows) {
      const engineerName = ticket.EngineerEmail.split('@')[0];
      const managerName  = ticket.ManagerEmail.split('@')[0];

      console.log(`🚨 SLA breach → ${ticket.TicketNo} | Manager: ${ticket.ManagerEmail}`);

      await notifyManagerSlaBreached(
        ticket.ManagerPhone,
        managerName,
        {
          ticketNo:     ticket.TicketNo,
          customerName: ticket.CustomerName,
          siteName:     ticket.SiteName,
          issueDetails: ticket.IssueDetails,
          priority:     ticket.priority,
          status:       ticket.Status,
          createdTime:  toIst(ticket.CreatedTime)
        },
        engineerName
      );

      escalatedIds.add(ticket.TicketID);
    }

    // Mark all escalated tickets in one query
    if (escalatedIds.size > 0) {
      const ids = [...escalatedIds];
      await pool.query(
        `UPDATE public."Tickets" SET "EscalationSent" = true WHERE "TicketID" = ANY($1)`,
        [ids]
      );
      console.log(`✅ Escalated ${ids.length} ticket(s) to managers`);
    }

  } catch (err) {
    console.error('❌ Escalation check error:', err.message);
  }
};

// ─── Start Cron ──────────────────────────────────────────────────────────────
const startEscalationJob = () => {
  console.log('🕐 Escalation job started — runs every 5 minutes');

  // Every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log(`\n🔄 [${toIst(new Date())}] Running ticket checks...`);
    await checkReminders();
    await checkEscalations();
  });
};

module.exports = { startEscalationJob };