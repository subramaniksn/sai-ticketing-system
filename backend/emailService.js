const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createEmailService({ fetchImpl = global.fetch, env = process.env } = {}) {
  let cachedToken = null;
  let tokenExpiresAt = 0;

  function getConfig() {
    const config = {
      tenantId: env.MS_TENANT_ID?.trim(),
      clientId: env.MS_CLIENT_ID?.trim(),
      clientSecret: env.MS_CLIENT_SECRET?.trim(),
      mailbox: env.SUPPORT_MAILBOX?.trim()
    };
    const missing = Object.entries(config)
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missing.length) {
      throw new Error(`Microsoft email configuration missing: ${missing.join(", ")}`);
    }
    return config;
  }

  function isConfigured() {
    try {
      getConfig();
      return true;
    } catch {
      return false;
    }
  }

  async function getAccessToken() {
    if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

    const config = getConfig();
    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials"
    });
    const response = await fetchImpl(
      `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body
      }
    );
    const payload = await response.json();

    if (!response.ok || !payload.access_token) {
      throw new Error(`Microsoft token request failed (${response.status})`);
    }

    cachedToken = payload.access_token;
    tokenExpiresAt = Date.now() + Math.max(60, Number(payload.expires_in || 3600) - 300) * 1000;
    return cachedToken;
  }

  async function graphRequest(pathOrUrl, options = {}) {
    const token = await getAccessToken();
    const response = await fetchImpl(
      pathOrUrl.startsWith("https://") ? pathOrUrl : `${GRAPH_BASE_URL}${pathOrUrl}`,
      {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...options.headers
        }
      }
    );

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Microsoft Graph request failed (${response.status}): ${details.slice(0, 300)}`);
    }

    if (response.status === 202 || response.status === 204) return null;
    return response.json();
  }

  async function sendEmail({ to, subject, html }) {
    const recipients = (Array.isArray(to) ? to : [to])
      .map((address) => String(address || "").trim())
      .filter(Boolean)
      .map((address) => ({ emailAddress: { address } }));

    if (!recipients.length) throw new Error("At least one email recipient is required");

    const { mailbox } = getConfig();
    await graphRequest(`/users/${encodeURIComponent(mailbox)}/sendMail`, {
      method: "POST",
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: "HTML", content: html },
          toRecipients: recipients
        },
        saveToSentItems: true
      })
    });
  }

  async function listSupportMessagesSince(since) {
    const { mailbox } = getConfig();
    const params = new URLSearchParams({
      "$filter": `receivedDateTime ge ${new Date(since).toISOString()}`,
      "$orderby": "receivedDateTime asc",
      "$top": "50",
      "$select": [
        "id",
        "internetMessageId",
        "subject",
        "receivedDateTime",
        "from",
        "sender",
        "bodyPreview",
        "body",
        "internetMessageHeaders"
      ].join(",")
    });
    let nextUrl = `${GRAPH_BASE_URL}/users/${encodeURIComponent(mailbox)}/mailFolders/inbox/messages?${params}`;
    const messages = [];

    while (nextUrl) {
      const payload = await graphRequest(nextUrl, {
        headers: { Prefer: 'outlook.body-content-type="text"' }
      });
      messages.push(...(payload.value || []));
      nextUrl = payload["@odata.nextLink"] || null;
    }

    return messages;
  }

  const appUrl = () => escapeHtml(env.APP_URL || "http://localhost:3000");
  const nameFromEmail = (email) => escapeHtml(String(email || "").split("@")[0]);

  async function notifyEngineerTicketAssigned(email, ticket) {
    const remoteSchedule = ticket.remoteConnectionScheduledAt
      ? `<br><strong>Remote connection scheduled:</strong> ${escapeHtml(ticket.remoteConnectionScheduledAt)} IST`
      : "";
    await sendEmail({
      to: email,
      subject: `[${ticket.priority}] New ticket assigned: ${ticket.ticketNo}`,
      html: `
        <h2>New Ticket Assigned</h2>
        <p>Hello ${nameFromEmail(email)},</p>
        <p><strong>Ticket:</strong> ${escapeHtml(ticket.ticketNo)}<br>
        <strong>Customer:</strong> ${escapeHtml(ticket.customerName)}<br>
        <strong>Site:</strong> ${escapeHtml(ticket.siteName)}<br>
        <strong>Priority:</strong> ${escapeHtml(ticket.priority)}<br>
        <strong>Created:</strong> ${escapeHtml(ticket.createdTime)} IST${remoteSchedule}</p>
        <p><strong>Issue</strong><br>${escapeHtml(ticket.issueDetails).replaceAll("\n", "<br>")}</p>
        <p><a href="${appUrl()}">Open Engineer Dashboard</a></p>
        <p>Please start work within 20 minutes.</p>`
    });
  }

  async function notifyCustomerTicketCreated(email, ticket, engineer) {
    await sendEmail({
      to: email,
      subject: `Support ticket created: ${ticket.ticketNo}`,
      html: `
        <h2>Your Support Ticket Has Been Created</h2>
        <p>Hello ${escapeHtml(ticket.customerName)},</p>
        <p>We received your support request and assigned it to an engineer.</p>
        <p><strong>Ticket:</strong> ${escapeHtml(ticket.ticketNo)}<br>
        <strong>Priority:</strong> ${escapeHtml(ticket.priority)}<br>
        <strong>Created:</strong> ${escapeHtml(ticket.createdTime)} IST<br>
        <strong>Remote connection scheduled:</strong> ${escapeHtml(ticket.remoteConnectionScheduledAt)} IST</p>
        <p><strong>Assigned engineer</strong><br>
        Email: ${escapeHtml(engineer.email)}<br>
        Phone: ${escapeHtml(engineer.phone || "Not available")}</p>
        <p>Please keep your remote-access system ready at the scheduled time. Replying to this automated acknowledgement will not create another ticket; contact the support mailbox if a new request is needed.</p>
        <p>Regards,<br>SAI Automation Support</p>`
    });
  }

  async function notifyEngineerReminder(email, ticket) {
    await sendEmail({
      to: email,
      subject: `Reminder: ${ticket.ticketNo} has not been started`,
      html: `
        <h2>Ticket Not Started</h2>
        <p>Hello ${nameFromEmail(email)},</p>
        <p>Ticket <strong>${escapeHtml(ticket.ticketNo)}</strong> was assigned 20 minutes ago and is still open.</p>
        <p><strong>Customer:</strong> ${escapeHtml(ticket.customerName)}<br>
        <strong>Site:</strong> ${escapeHtml(ticket.siteName)}<br>
        <strong>Priority:</strong> ${escapeHtml(ticket.priority)}</p>
        <p><a href="${appUrl()}">Start Work Now</a></p>`
    });
  }

  async function notifyManagerSlaBreached(email, ticket, engineerEmail) {
    const slaHours = { High: 2, Medium: 8, Low: 24 }[ticket.priority] || 8;
    await sendEmail({
      to: email,
      subject: `SLA breached: ${ticket.ticketNo} (${ticket.priority})`,
      html: `
        <h2>SLA Escalation</h2>
        <p>Ticket <strong>${escapeHtml(ticket.ticketNo)}</strong> has breached its ${slaHours}-hour SLA.</p>
        <p><strong>Customer:</strong> ${escapeHtml(ticket.customerName)}<br>
        <strong>Site:</strong> ${escapeHtml(ticket.siteName)}<br>
        <strong>Engineer:</strong> ${escapeHtml(engineerEmail)}<br>
        <strong>Status:</strong> ${escapeHtml(ticket.status)}<br>
        <strong>Created:</strong> ${escapeHtml(ticket.createdTime)} IST</p>
        <p><strong>Issue</strong><br>${escapeHtml(ticket.issueDetails).replaceAll("\n", "<br>")}</p>
        <p><a href="${appUrl()}">Review Manager Dashboard</a></p>`
    });
  }

  async function notifyDispatcherManagerAlert(email, notification) {
    await sendEmail({
      to: email,
      subject: `Manager alert: ${notification.customerName} (${notification.priority})`,
      html: `
        <h2>Manager Alert</h2>
        <p><strong>Sent by:</strong> ${escapeHtml(notification.sentBy)}<br>
        <strong>Customer:</strong> ${escapeHtml(notification.customerName)}<br>
        <strong>Site:</strong> ${escapeHtml(notification.siteName)}<br>
        <strong>Priority:</strong> ${escapeHtml(notification.priority)}</p>
        <p><strong>Issue</strong><br>${escapeHtml(notification.issueDetails).replaceAll("\n", "<br>")}</p>
        <p><a href="${appUrl()}">Open Dispatcher Dashboard</a></p>`
    });
  }

  return {
    isConfigured,
    listSupportMessagesSince,
    notifyDispatcherManagerAlert,
    notifyCustomerTicketCreated,
    notifyEngineerReminder,
    notifyEngineerTicketAssigned,
    notifyManagerSlaBreached,
    sendEmail
  };
}

const emailService = createEmailService();

module.exports = { ...emailService, createEmailService, escapeHtml };
