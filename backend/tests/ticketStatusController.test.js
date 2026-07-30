const test = require("node:test");
const assert = require("node:assert/strict");

const { createTicketStatusController } = require("../controllers/ticketStatusController");

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

test("rejects ticket status updates by non-engineers", async () => {
  const pool = { query: async () => assert.fail("database should not be called") };
  const controller = createTicketStatusController({ pool });
  const res = createResponse();

  await controller.updateTicketStatus({
    user: { role: "Dispatcher" },
    params: { id: "10" },
    body: { status: "InProgress" }
  }, res);

  assert.equal(res.statusCode, 403);
});

test("rejects invalid ticket IDs and status transitions", async () => {
  const pool = { query: async () => assert.fail("database should not be called") };
  const controller = createTicketStatusController({ pool });

  const invalidIdResponse = createResponse();
  await controller.updateTicketStatus({
    user: { role: "Engineer", email: "engineer@example.com" },
    params: { id: "invalid" },
    body: { status: "InProgress" }
  }, invalidIdResponse);
  assert.equal(invalidIdResponse.statusCode, 400);

  const invalidStatusResponse = createResponse();
  await controller.updateTicketStatus({
    user: { role: "Engineer", email: "engineer@example.com" },
    params: { id: "10" },
    body: { status: "Resolved" }
  }, invalidStatusResponse);
  assert.equal(invalidStatusResponse.statusCode, 400);
});

test("starts work only for the assigned engineer and returns the saved state", async () => {
  const savedTicket = {
    TicketID: 10,
    Status: "InProgress",
    InProgress_Date: "2026-07-29T10:00:00.000Z",
    Pending_Date: null
  };
  const pool = {
    async query(sql, values) {
      assert.match(sql, /"InProgress_Date" = NOW\(\)/);
      assert.match(sql, /RETURNING "TicketID", "Status"/);
      assert.deepEqual(values, ["InProgress", 10, "engineer@example.com", "Open"]);
      return { rowCount: 1, rows: [savedTicket] };
    }
  };
  const controller = createTicketStatusController({ pool });
  const res = createResponse();

  await controller.updateTicketStatus({
    user: { role: "Engineer", email: "engineer@example.com" },
    params: { id: "10" },
    body: { status: "InProgress" }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.ticket, savedTicket);
});

test("reports an invalid workflow when no assigned ticket was updated", async () => {
  const pool = { query: async () => ({ rowCount: 0, rows: [] }) };
  const controller = createTicketStatusController({ pool });
  const res = createResponse();

  await controller.updateTicketStatus({
    user: { role: "Engineer", email: "engineer@example.com" },
    params: { id: "10" },
    body: { status: "Pending" }
  }, res);

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.msg, "Invalid workflow step");
});
