const test = require("node:test");
const assert = require("node:assert/strict");

const {
  calculateRemoteConnectionSchedule,
  classifySupportEmail,
  inferPriority
} = require("../emailIntakeJob");

function message(overrides = {}) {
  return {
    id: "graph-message-1",
    internetMessageId: "<message-1@example.com>",
    subject: "SCADA value is not updating",
    bodyPreview: "Please check this issue at our plant.",
    from: {
      emailAddress: {
        address: "customer@example.com",
        name: "Customer"
      }
    },
    internetMessageHeaders: [],
    ...overrides
  };
}

test("accepts a genuine new external support email", () => {
  const result = classifySupportEmail(message(), ["saiautomation.co.in"]);

  assert.equal(result.accepted, true);
  assert.equal(result.senderEmail, "customer@example.com");
});

test("rejects internal, reply, and forwarded emails", () => {
  const internal = classifySupportEmail(message({
    from: { emailAddress: { address: "engineer@saiautomation.co.in" } }
  }));
  const reply = classifySupportEmail(message({ subject: "RE: Existing ticket" }));
  const forwarded = classifySupportEmail(message({ subject: "Fwd: Existing ticket" }));

  assert.equal(internal.reason, "internal-email");
  assert.equal(reply.reason, "reply-or-forward");
  assert.equal(forwarded.reason, "reply-or-forward");
});

test("rejects automated and advertising emails", () => {
  const automated = classifySupportEmail(message({
    internetMessageHeaders: [{ name: "Auto-Submitted", value: "auto-generated" }]
  }));
  const mailingList = classifySupportEmail(message({
    internetMessageHeaders: [{ name: "List-Unsubscribe", value: "<mailto:unsubscribe@example.com>" }]
  }));
  const advertising = classifySupportEmail(message({
    subject: "Special promotional offer",
    bodyPreview: "Unsubscribe here"
  }));

  assert.equal(automated.reason, "automated-email");
  assert.equal(mailingList.reason, "advertising-or-bulk");
  assert.equal(advertising.reason, "advertising-or-bulk");
});

test("infers high, medium, and low ticket priorities", () => {
  assert.equal(inferPriority(message({ subject: "Urgent: production down" })), "High");
  assert.equal(inferPriority(message({ subject: "Normal support request" })), "Medium");
  assert.equal(inferPriority(message({ subject: "Minor issue - when possible" })), "Low");
});

test("schedules the remote connection exactly 10 minutes after ticket creation", () => {
  const createdAt = new Date("2026-07-30T10:00:00.000Z");

  assert.equal(
    calculateRemoteConnectionSchedule(createdAt).toISOString(),
    "2026-07-30T10:10:00.000Z"
  );
});
