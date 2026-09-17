const cron = require("node-cron");
const pool = require("./db");
const { sendManagerWhatsApp } = require("./whatsappService");

const SLA_HOURS = { High: 2, Medium: 8, Low: 24 };

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

function nameFromEmail(email) {
  return String(email || "").split("@")[0];
}

// 20-minute "not started" reminder to the engineer
async function checkReminders() {
  try {
    const { rows } = await pool.query(`
      SELECT
        t."TicketID", t."TicketNo", t."CustomerName", t."SiteName",
        t."IssueDetails", t."priority", t."CreatedTime",
        u."Email" AS "EngineerEmail", u."Phone" AS "EngineerPhone"
      FROM public."Tickets" t
      JOIN public."Users" u ON u."Email" = t."AssignedTo"
      WHERE
        t."Status" = 'Open'
        AND t."ReminderSent" = false
        AND t."CreatedTime" <= NOW() - INTERVAL '20 minutes'
    `);

    for (const ticket of rows) {
      console.log(`20-minute reminder: ${ticket.TicketNo} -> ${ticket.EngineerEmail}`);

      if (ticket.EngineerPhone) {
        const message =
          `⏰ *Reminder — Ticket Not Started!*\n\n` +
          `👤 Engineer: *${nameFromEmail(ticket.EngineerEmail)}*\n` +
          `🎟️ Ticket No: *${ticket.TicketNo}*\n` +
          `🏢 Customer: *${ticket.CustomerName}*\n` +
          `⚠️ Priority: *${ticket.priority}*\n\n` +
          `🚨 This ticket was assigned 20 minutes ago and has NOT been started yet.\n\n` +
          `Please login immediately:\nhttps://ticket.saiautomation.co.in`;

        await sendManagerWhatsApp(ticket.EngineerPhone, message);
      } else {
        console.warn(`Engineer phone not found for ${ticket.EngineerEmail}; reminder skipped`);
      }

      await pool.query(
        `UPDATE public."Tickets" SET "ReminderSent" = true WHERE "TicketID" = $1`,
        [ticket.TicketID]
      );
    }
  } catch (error) {
    console.error("Reminder check error:", error.message);
  }
}

// Engineer started work but hasn't completed within 1 hour of starting
async function checkOneHourNotCompleted() {
  try {
    const { rows } = await pool.query(`
      SELECT
        t."TicketID", t."TicketNo", t."CustomerName", t."SiteName",
        t."priority", t."InProgress_Date",
        u."Email" AS "EngineerEmail", u."Phone" AS "EngineerPhone"
      FROM public."Tickets" t
      JOIN public."Users" u ON u."Email" = t."AssignedTo"
      WHERE
        t."Status" = 'InProgress'
        AND t."OneHourAlertSent" = false
        AND t."InProgress_Date" IS NOT NULL
        AND t."InProgress_Date" <= NOW() - INTERVAL '1 hour'
    `);

    for (const ticket of rows) {
      console.log(`1-hour not-completed alert: ${ticket.TicketNo} -> ${ticket.EngineerEmail}`);

      if (ticket.EngineerPhone) {
        const message =
          `⏳ *Reminder — Task Still In Progress!*\n\n` +
          `👤 Engineer: *${nameFromEmail(ticket.EngineerEmail)}*\n` +
          `🎟️ Ticket No: *${ticket.TicketNo}*\n` +
          `🏢 Customer: *${ticket.CustomerName}*\n` +
          `⚠️ Priority: *${ticket.priority}*\n\n` +
          `🚨 You started this ticket over 1 hour ago and it is still not completed.\n\n` +
          `Please update the status or resolve the ticket:\nhttps://ticket.saiautomation.co.in`;

        await sendManagerWhatsApp(ticket.EngineerPhone, message);
      } else {
        console.warn(`Engineer phone not found for ${ticket.EngineerEmail}; 1-hour alert skipped`);
      }

      await pool.query(
        `UPDATE public."Tickets" SET "OneHourAlertSent" = true WHERE "TicketID" = $1`,
        [ticket.TicketID]
      );
    }
  } catch (error) {
    console.error("1-hour not-completed check error:", error.message);
  }
}

// SLA breach -> notify dispatchers (NOT manager)
async function checkEscalations() {
  try {
    const { rows } = await pool.query(`
      SELECT
        t."TicketID", t."TicketNo", t."CustomerName", t."SiteName",
        t."IssueDetails", t."priority", t."CreatedTime", t."Status",
        u."Email" AS "EngineerEmail"
      FROM public."Tickets" t
      JOIN public."Users" u ON u."Email" = t."AssignedTo"
      WHERE
        t."Status" <> 'Resolved'
        AND t."EscalationSent" = false
        AND (
          (t."priority" = 'High' AND t."CreatedTime" <= NOW() - INTERVAL '2 hours') OR
          (t."priority" = 'Medium' AND t."CreatedTime" <= NOW() - INTERVAL '8 hours') OR
          (t."priority" = 'Low' AND t."CreatedTime" <= NOW() - INTERVAL '24 hours')
        )
    `);

    if (!rows.length) return;

    const dispatcherRes = await pool.query(
      `SELECT "Email", "Phone" FROM public."Users" WHERE "Role" = 'Dispatcher'`
    );
    const dispatchers = dispatcherRes.rows.filter((d) => d.Phone);

    const sentTicketIds = [];

    for (const ticket of rows) {
      try {
        const slaHours = SLA_HOURS[ticket.priority] || "N/A";

        if (dispatchers.length) {
          await Promise.all(
            dispatchers.map((d) => {
              const perDispatcherMessage =
                `🚨 *SLA ESCALATION — SAI Automation*\n\n` +
                `👔 Dispatcher: *${nameFromEmail(d.Email)}*\n\n` +
                `Ticket has breached SLA!\n\n` +
                `🎟️ Ticket No: *${ticket.TicketNo}*\n` +
                `🏢 Customer: *${ticket.CustomerName}*\n` +
                `📍 Site: *${ticket.SiteName}*\n` +
                `⚠️ Priority: *${ticket.priority}* (SLA: ${slaHours}h)\n` +
                `👷 Engineer: *${nameFromEmail(ticket.EngineerEmail)}*\n` +
                `🕒 Created: *${toIst(ticket.CreatedTime)}* (IST)\n` +
                `📊 Status: *${ticket.Status}*\n\n` +
                `📋 Issue:\n${ticket.IssueDetails}\n\n` +
                `🔐 Review on dashboard:\nhttps://ticket.saiautomation.co.in`;

              return sendManagerWhatsApp(d.Phone, perDispatcherMessage);
            })
          );
        } else {
          console.warn(`No dispatcher phone found; SLA escalation for ${ticket.TicketNo} not sent`);
        }

        sentTicketIds.push(ticket.TicketID);
      } catch (error) {
        console.error(`SLA WhatsApp failed for ${ticket.TicketNo}:`, error.message);
      }
    }

    if (sentTicketIds.length) {
      await pool.query(
        `UPDATE public."Tickets" SET "EscalationSent" = true WHERE "TicketID" = ANY($1)`,
        [sentTicketIds]
      );
      console.log(`SLA escalation sent via WhatsApp for ${sentTicketIds.length} ticket(s)`);
    }
  } catch (error) {
    console.error("Escalation check error:", error.message);
  }
}

function startEscalationJob() {
  console.log("WhatsApp reminder and SLA job started - runs every 5 minutes");
  cron.schedule("*/5 * * * *", async () => {
    await checkReminders();
    await checkOneHourNotCompleted();
    await checkEscalations();
  });
}

module.exports = {
  checkEscalations,
  checkReminders,
  checkOneHourNotCompleted,
  startEscalationJob
};
