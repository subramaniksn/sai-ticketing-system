const cron = require("node-cron");
const pool = require("./db");
const {
  notifyEngineerReminder,
  notifyManagerSlaBreached
} = require("./emailService");

function toIst(dateString) {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: true,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

async function checkReminders() {
  try {
    const { rows } = await pool.query(`
      SELECT
        t."TicketID", t."TicketNo", t."CustomerName", t."SiteName",
        t."IssueDetails", t."priority", t."CreatedTime",
        u."Email" AS "EngineerEmail"
      FROM public."Tickets" t
      JOIN public."Users" u ON u."Email" = t."AssignedTo"
      WHERE
        t."Status" = 'Open'
        AND t."ReminderSent" = false
        AND t."CreatedTime" <= NOW() - INTERVAL '20 minutes'
    `);

    for (const ticket of rows) {
      console.log(`20-minute reminder: ${ticket.TicketNo} -> ${ticket.EngineerEmail}`);
      await notifyEngineerReminder(ticket.EngineerEmail, {
        ticketNo: ticket.TicketNo,
        customerName: ticket.CustomerName,
        siteName: ticket.SiteName,
        priority: ticket.priority
      });
      await pool.query(
        `UPDATE public."Tickets" SET "ReminderSent" = true WHERE "TicketID" = $1`,
        [ticket.TicketID]
      );
    }
  } catch (error) {
    console.error("Reminder check error:", error.message);
  }
}

async function checkEscalations() {
  try {
    const { rows } = await pool.query(`
      SELECT
        t."TicketID", t."TicketNo", t."CustomerName", t."SiteName",
        t."IssueDetails", t."priority", t."CreatedTime", t."Status",
        u."Email" AS "EngineerEmail",
        ARRAY_AGG(m."Email" ORDER BY m."Email") AS "ManagerEmails"
      FROM public."Tickets" t
      JOIN public."Users" u ON u."Email" = t."AssignedTo"
      CROSS JOIN (
        SELECT "Email" FROM public."Users" WHERE "Role" = 'Manager'
      ) m
      WHERE
        t."Status" <> 'Resolved'
        AND t."EscalationSent" = false
        AND (
          (t."priority" = 'High' AND t."CreatedTime" <= NOW() - INTERVAL '2 hours') OR
          (t."priority" = 'Medium' AND t."CreatedTime" <= NOW() - INTERVAL '8 hours') OR
          (t."priority" = 'Low' AND t."CreatedTime" <= NOW() - INTERVAL '24 hours')
        )
      GROUP BY
        t."TicketID", t."TicketNo", t."CustomerName", t."SiteName",
        t."IssueDetails", t."priority", t."CreatedTime", t."Status",
        u."Email"
    `);

    const sentTicketIds = [];

    for (const ticket of rows) {
      try {
        await notifyManagerSlaBreached(
          ticket.ManagerEmails,
          {
            ticketNo: ticket.TicketNo,
            customerName: ticket.CustomerName,
            siteName: ticket.SiteName,
            issueDetails: ticket.IssueDetails,
            priority: ticket.priority,
            status: ticket.Status,
            createdTime: toIst(ticket.CreatedTime)
          },
          ticket.EngineerEmail
        );
        sentTicketIds.push(ticket.TicketID);
      } catch (error) {
        console.error(`SLA email failed for ${ticket.TicketNo}:`, error.message);
      }
    }

    if (sentTicketIds.length) {
      await pool.query(
        `UPDATE public."Tickets" SET "EscalationSent" = true WHERE "TicketID" = ANY($1)`,
        [sentTicketIds]
      );
      console.log(`SLA escalation emailed for ${sentTicketIds.length} ticket(s)`);
    }
  } catch (error) {
    console.error("Escalation check error:", error.message);
  }
}

function startEscalationJob() {
  console.log("Email reminder and SLA job started - runs every 5 minutes");
  cron.schedule("*/5 * * * *", async () => {
    await checkReminders();
    await checkEscalations();
  });
}

module.exports = { checkEscalations, checkReminders, startEscalationJob };
