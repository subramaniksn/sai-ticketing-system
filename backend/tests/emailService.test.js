const test = require("node:test");
const assert = require("node:assert/strict");

const { createEmailService, escapeHtml } = require("../emailService");

function response({ ok = true, status = 200, json = {}, text = "" } = {}) {
  return {
    ok,
    status,
    async json() {
      return json;
    },
    async text() {
      return text;
    }
  };
}

const env = {
  MS_TENANT_ID: "tenant-id",
  MS_CLIENT_ID: "client-id",
  MS_CLIENT_SECRET: "client-secret",
  SUPPORT_MAILBOX: "support@example.com",
  APP_URL: "https://ticket.example.com"
};

test("reports whether Microsoft email settings are complete", () => {
  assert.equal(createEmailService({ env, fetchImpl: async () => {} }).isConfigured(), true);
  assert.equal(createEmailService({ env: {}, fetchImpl: async () => {} }).isConfigured(), false);
});

test("sends email through Microsoft Graph using an application token", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.includes("login.microsoftonline.com")) {
      return response({
        json: { access_token: "graph-token", expires_in: 3600 }
      });
    }
    return response({ status: 202 });
  };
  const service = createEmailService({ env, fetchImpl });

  await service.sendEmail({
    to: ["engineer@example.com"],
    subject: "New ticket",
    html: "<p>Ticket details</p>"
  });

  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /tenant-id\/oauth2\/v2\.0\/token$/);
  assert.match(calls[1].url, /users\/support%40example\.com\/sendMail$/);
  assert.equal(calls[1].options.headers.Authorization, "Bearer graph-token");
  const sent = JSON.parse(calls[1].options.body);
  assert.equal(sent.message.toRecipients[0].emailAddress.address, "engineer@example.com");
  assert.equal(sent.saveToSentItems, true);
});

test("escapes untrusted email content used in HTML templates", () => {
  assert.equal(
    escapeHtml('<img src=x onerror="alert(1)">'),
    "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"
  );
});

test("emails the customer ticket, engineer, and remote schedule details", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.includes("login.microsoftonline.com")) {
      return response({ json: { access_token: "graph-token", expires_in: 3600 } });
    }
    return response({ status: 202 });
  };
  const service = createEmailService({ env, fetchImpl });

  await service.notifyCustomerTicketCreated(
    "customer@example.com",
    {
      ticketNo: "SAI-2026-07-100",
      customerName: "Customer",
      priority: "High",
      createdTime: "30 Jul 2026, 03:30 pm",
      remoteConnectionScheduledAt: "30 Jul 2026, 03:40 pm"
    },
    {
      email: "engineer@example.com",
      phone: "+91 90000 00000"
    }
  );

  const sent = JSON.parse(calls[1].options.body).message;
  assert.equal(sent.toRecipients[0].emailAddress.address, "customer@example.com");
  assert.match(sent.subject, /SAI-2026-07-100/);
  assert.match(sent.body.content, /engineer@example\.com/);
  assert.match(sent.body.content, /03:40 pm/);
});
