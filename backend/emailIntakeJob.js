const cron = require("node-cron");
const pool = require("./db");
const emailService = require("./emailService");

const DEFAULT_INTERNAL_DOMAINS = ["saiautomation.co.in"];

function normalizeHeaderMap(headers = []) {
  return Object.fromEntries(
    headers.map((header) => [
      String(header.name || "").toLowerCase(),
      String(header.value || "")
    ])
  );
}

function classifySupportEmail(message, internalDomains = DEFAULT_INTERNAL_DOMAINS) {
  const senderEmail = message.from?.emailAddress?.address?.trim().toLowerCase() || "";
  const subject = String(message.subject || "").trim();
  const preview = String(message.bodyPreview || "");
  const headers = normalizeHeaderMap(message.internetMessageHeaders);
  const senderDomain = senderEmail.split("@")[1] || "";

  if (!senderEmail) return { accepted: false, reason: "missing-sender" };
  if (internalDomains.some((domain) => senderDomain === domain || senderDomain.endsWith(`.${domain}`))) {
    return { accepted: false, reason: "internal-email" };
  }
  if (/^(?:\s*(?:re|fw|fwd)\s*:)+/i.test(subject)) {
    return { accepted: false, reason: "reply-or-forward" };
  }

  const autoSubmitted = headers["auto-submitted"]?.toLowerCase();
  const precedence = headers.precedence?.toLowerCase();
  const automatedSender = /^(?:no-?reply|do-?not-?reply|mailer-daemon|postmaster)@/i.test(senderEmail);
  const bulkHeaders = headers["list-id"] || headers["list-unsubscribe"] ||
    ["bulk", "list", "junk"].includes(precedence);
  const advertisingText = `${subject}\n${preview}`.toLowerCase();
  const advertising = /\b(unsubscribe|newsletter|advertisement|marketing campaign|special offer|promotional)\b/.test(advertisingText);

  if ((autoSubmitted && autoSubmitted !== "no") || automatedSender) {
    return { accepted: false, reason: "automated-email" };
  }
  if (bulkHeaders || advertising) {
    return { accepted: false, reason: "advertising-or-bulk" };
  }

  return { accepted: true, reason: "new-external-request", senderEmail };
}

function inferPriority(message) {
  const text = `${message.subject || ""}\n${message.bodyPreview || ""}`.toLowerCase();
  if (/\b(critical|emergency|production down|plant down|system down|urgent)\b/.test(text)) return "High";
  if (/\b(low priority|minor|when possible)\b/.test(text)) return "Low";
  return "Medium";
}

function calculateRemoteConnectionSchedule(createdAt) {
  return new Date(new Date(createdAt).getTime() + 10 * 60 * 1000);
}

function toIst(dateString) {
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

function createEmailIntakeJob({
  database = pool,
  mailer = emailService,
  environment = process.env
} = {}) {
  const internalDomains = (environment.INTERNAL_EMAIL_DOMAINS || DEFAULT_INTERNAL_DOMAINS.join(","))
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);

  async function processMessage(message) {
    const client = await database.connect();
    let transactionStarted = false;

    try {
      await client.query("BEGIN");
      transactionStarted = true;

      const messageKey = message.internetMessageId || message.id;
      const claimed = await client.query(
        `INSERT INTO "ProcessedSupportEmails"
         ("InternetMessageID", "GraphMessageID", "SenderEmail", "Subject", "Outcome")
         VALUES ($1, $2, $3, $4, 'Processing')
         ON CONFLICT ("InternetMessageID") DO NOTHING
         RETURNING "InternetMessageID"`,
        [
          messageKey,
          message.id,
          message.from?.emailAddress?.address || null,
          message.subject || "(no subject)"
        ]
      );

      if (!claimed.rowCount) {
        await client.query("ROLLBACK");
        transactionStarted = false;
        return { outcome: "duplicate" };
      }

      const classification = classifySupportEmail(message, internalDomains);
      if (!classification.accepted) {
        await client.query(
          `UPDATE "ProcessedSupportEmails"
           SET "Outcome" = $1, "ProcessedAt" = NOW()
           WHERE "InternetMessageID" = $2`,
          [`Ignored: ${classification.reason}`, messageKey]
        );
        await client.query("COMMIT");
        transactionStarted = false;
        return { outcome: classification.reason };
      }

      const engineerResult = await client.query(
        `SELECT u."Email", u."Phone"
         FROM "Users" u
         LEFT JOIN "Tickets" t
           ON lower(btrim(t."AssignedTo")) = lower(btrim(u."Email"))
          AND t."Status" <> 'Resolved'
         WHERE u."Role" = 'Engineer'
         GROUP BY u."UserID", u."Email"
         ORDER BY COUNT(t."TicketID") ASC, u."UserID" ASC
         LIMIT 1`
      );
      const engineerEmail = engineerResult.rows[0]?.Email;
      const engineerPhone = engineerResult.rows[0]?.Phone;
      if (!engineerEmail) throw new Error("No engineer is available for automatic assignment");

      const receivedAt = new Date(message.receivedDateTime || Date.now());
      const year = receivedAt.getFullYear();
      const month = String(receivedAt.getMonth() + 1).padStart(2, "0");
      const ticketPrefix = `SAI-${year}-${month}`;
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [ticketPrefix]);
      const countResult = await client.query(
        `SELECT COUNT(*)::int AS total FROM "Tickets" WHERE "TicketNo" LIKE $1`,
        [`${ticketPrefix}%`]
      );
      const ticketNo = `${ticketPrefix}-${String(countResult.rows[0].total + 1).padStart(3, "0")}`;

      const senderName = message.from?.emailAddress?.name?.trim();
      const customerName = (senderName || classification.senderEmail.split("@")[0]).slice(0, 200);
      const subject = String(message.subject || "(no subject)").trim();
      const bodyText = String(message.body?.content || message.bodyPreview || "").trim();
      const issueDetails = [
        `Email from: ${classification.senderEmail}`,
        `Subject: ${subject}`,
        "",
        bodyText || "(No email body)"
      ].join("\n").slice(0, 10000);
      const priority = inferPriority(message);
      const createdAt = new Date();
      const remoteConnectionScheduledAt = calculateRemoteConnectionSchedule(createdAt);

      const ticketResult = await client.query(
        `INSERT INTO "Tickets"
         ("TicketNo", "CustomerName", "SiteName", "IssueDetails", "priority",
          "AssignedTo", "AmcCustomerId", "TicketType", "Status",
          "ReminderSent", "EscalationSent", "RemoteConnectionScheduledAt")
         VALUES ($1, $2, 'Email Request', $3, $4, $5, NULL, 'EMAIL', 'Open', false, false, $6)
         RETURNING "TicketID"`,
        [ticketNo, customerName, issueDetails, priority, engineerEmail, remoteConnectionScheduledAt]
      );
      const ticketId = ticketResult.rows[0].TicketID;

      await client.query(
        `UPDATE "ProcessedSupportEmails"
         SET "Outcome" = 'Ticket Created', "TicketID" = $1, "ProcessedAt" = NOW()
         WHERE "InternetMessageID" = $2`,
        [ticketId, messageKey]
      );
      await client.query("COMMIT");
      transactionStarted = false;

      const notificationTicket = {
        ticketNo,
        customerName,
        siteName: "Email Request",
        issueDetails,
        priority,
        createdTime: toIst(createdAt),
        remoteConnectionScheduledAt: toIst(remoteConnectionScheduledAt)
      };
      const notificationResults = await Promise.allSettled([
        mailer.notifyEngineerTicketAssigned(engineerEmail, notificationTicket),
        mailer.notifyCustomerTicketCreated(
          classification.senderEmail,
          notificationTicket,
          { email: engineerEmail, phone: engineerPhone }
        )
      ]);
      const failedNotifications = notificationResults.filter((result) => result.status === "rejected");
      if (failedNotifications.length) {
        console.error(
          `Ticket ${ticketNo} created, but ${failedNotifications.length} email notification(s) failed:`,
          failedNotifications.map((result) => result.reason?.message || "Unknown error").join("; ")
        );
      }

      return { outcome: "created", ticketId, ticketNo, engineerEmail };
    } catch (error) {
      if (transactionStarted) await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async function checkInbox() {
    try {
      const state = await database.query(
        `SELECT "Value" FROM "EmailAutomationState" WHERE "Key" = 'last_polled_at'`
      );
      const lastPolledAt = state.rows[0]?.Value;
      if (!lastPolledAt) {
        console.warn("Email intake skipped: run npm run setup:email-automation first");
        return;
      }

      const pollStartedAt = new Date();
      const overlapStart = new Date(new Date(lastPolledAt).getTime() - 5 * 60 * 1000);
      const messages = await mailer.listSupportMessagesSince(overlapStart);
      let processingFailed = false;

      for (const message of messages) {
        try {
          const result = await processMessage(message);
          if (result.outcome === "created") {
            console.log(`Email ticket created: ${result.ticketNo} -> ${result.engineerEmail}`);
          }
        } catch (error) {
          processingFailed = true;
          console.error(`Email intake failed for message ${message.id}:`, error.message);
        }
      }

      if (!processingFailed) {
        await database.query(
          `UPDATE "EmailAutomationState"
           SET "Value" = $1, "UpdatedAt" = NOW()
           WHERE "Key" = 'last_polled_at'`,
          [pollStartedAt.toISOString()]
        );
      }
    } catch (error) {
      console.error("Email inbox check failed:", error.message);
    }
  }

  function start() {
    console.log("Outlook email intake started - runs every 2 minutes");
    checkInbox();
    cron.schedule("*/2 * * * *", checkInbox);
  }

  return { checkInbox, processMessage, start };
}

module.exports = {
  calculateRemoteConnectionSchedule,
  classifySupportEmail,
  createEmailIntakeJob,
  inferPriority
};
