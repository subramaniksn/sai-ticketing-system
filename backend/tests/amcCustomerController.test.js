const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

process.env.REMOTE_PASSWORD_ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");

const { createAmcCustomerController } = require("../controllers/amcCustomerController");
const { encryptRemotePassword } = require("../utils/remotePasswordCrypto");

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

const validBody = {
  customerName: "Example Energy",
  siteName: "Pavagada Site",
  systemName: "SCADA Server 1",
  siteContactName: "Site Manager",
  siteContactPhone: "+91 98765 43210",
  remoteTool: "AnyDesk",
  remoteId: "123 456 789",
  remotePassword: "secret"
};

test("rejects AMC creation by non-dispatchers", async () => {
  const pool = { query: async () => assert.fail("database should not be called") };
  const controller = createAmcCustomerController({ pool });
  const res = createResponse();

  await controller.createAmcCustomer({ user: { role: "Engineer" }, body: validBody }, res);

  assert.equal(res.statusCode, 403);
});

test("rejects password reveal by non-dispatchers", async () => {
  const pool = { query: async () => assert.fail("database should not be called") };
  const controller = createAmcCustomerController({ pool });
  const res = createResponse();

  await controller.getRemotePassword(
    { user: { role: "Engineer" }, params: { customerId: "7" } },
    res
  );

  assert.equal(res.statusCode, 403);
});

test("rejects invalid and whitespace-only AMC input", async () => {
  const pool = { query: async () => assert.fail("database should not be called") };
  const controller = createAmcCustomerController({ pool });
  const res = createResponse();

  await controller.createAmcCustomer({ user: { role: "Dispatcher" }, body: { customerName: "   ", siteName: "" } }, res);

  assert.equal(res.statusCode, 400);
  assert.ok(res.body.errors.length >= 2);
});

test("rejects duplicate customer, site, and system", async () => {
  const pool = { query: async () => ({ rows: [{ CustomerID: 5 }] }) };
  const controller = createAmcCustomerController({ pool });
  const res = createResponse();

  await controller.createAmcCustomer({ user: { role: "Dispatcher" }, body: validBody }, res);

  assert.equal(res.statusCode, 409);
});

test("creates a validated AMC customer with an encrypted password", async () => {
  const calls = [];
  const pool = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return calls.length === 1 ? { rows: [] } : { rows: [{ CustomerID: 7 }] };
    }
  };
  const controller = createAmcCustomerController({ pool });
  const res = createResponse();

  await controller.createAmcCustomer({ user: { role: "Dispatcher" }, body: validBody }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.customerId, 7);
  assert.deepEqual(calls[0].params, ["Example Energy", "Pavagada Site", "SCADA Server 1"]);
  assert.match(calls[1].params[7], /^enc:v1:/);
  assert.notEqual(calls[1].params[7], validBody.remotePassword);
});

test("rejects AMC updates by non-dispatchers", async () => {
  const pool = { query: async () => assert.fail("database should not be called") };
  const controller = createAmcCustomerController({ pool });
  const res = createResponse();

  await controller.updateAmcCustomer(
    { user: { role: "Engineer" }, params: { customerId: "7" }, body: validBody },
    res
  );

  assert.equal(res.statusCode, 403);
});

test("updates AMC details without replacing the password when it is blank", async () => {
  const calls = [];
  const pool = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return calls.length === 1 ? { rows: [] } : { rows: [{ CustomerID: 7 }] };
    }
  };
  const controller = createAmcCustomerController({ pool });
  const res = createResponse();

  await controller.updateAmcCustomer(
    {
      user: { role: "Dispatcher" },
      params: { customerId: "7" },
      body: { ...validBody, siteContactName: "Updated Manager", remotePassword: "" }
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.customerId, 7);
  assert.doesNotMatch(calls[1].sql, /SET[\s\S]*"RemotePassword"/);
  assert.deepEqual(calls[1].params, [
    "Example Energy",
    "Pavagada Site",
    "SCADA Server 1",
    "Updated Manager",
    "+91 98765 43210",
    "AnyDesk",
    "123 456 789",
    7
  ]);
});

test("encrypts a new remote password during an AMC update", async () => {
  const calls = [];
  const pool = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return calls.length === 1 ? { rows: [] } : { rows: [{ CustomerID: 7 }] };
    }
  };
  const controller = createAmcCustomerController({ pool });
  const res = createResponse();

  await controller.updateAmcCustomer(
    { user: { role: "Dispatcher" }, params: { customerId: "7" }, body: validBody },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.match(calls[1].sql, /"RemotePassword"/);
  assert.match(calls[1].params[7], /^enc:v1:/);
  assert.notEqual(calls[1].params[7], validBody.remotePassword);
});

test("rejects an AMC update that duplicates another customer, site, and system", async () => {
  const pool = { query: async () => ({ rows: [{ CustomerID: 8 }] }) };
  const controller = createAmcCustomerController({ pool });
  const res = createResponse();

  await controller.updateAmcCustomer(
    { user: { role: "Dispatcher" }, params: { customerId: "7" }, body: validBody },
    res
  );

  assert.equal(res.statusCode, 409);
});

test("returns not found when updating a missing AMC customer", async () => {
  let callCount = 0;
  const pool = {
    query: async () => {
      callCount += 1;
      return { rows: [] };
    }
  };
  const controller = createAmcCustomerController({ pool });
  const res = createResponse();

  await controller.updateAmcCustomer(
    { user: { role: "Dispatcher" }, params: { customerId: "999" }, body: validBody },
    res
  );

  assert.equal(callCount, 2);
  assert.equal(res.statusCode, 404);
});

test("AMC list never returns remote passwords", async () => {
  const pool = {
    query: async () => ({ rows: [{ CustomerID: 7, CustomerName: "Example", HasRemotePassword: true }] })
  };
  const controller = createAmcCustomerController({ pool });
  const res = createResponse();

  await controller.getAmcCustomers({ user: { role: "Dispatcher" } }, res);

  assert.equal(res.headers["Cache-Control"], "no-store");
  assert.equal(Object.hasOwn(res.body[0], "RemotePassword"), false);
});

test("reveals a decrypted password only through the explicit endpoint", async () => {
  const encrypted = encryptRemotePassword("secret");
  const pool = { query: async () => ({ rows: [{ RemotePassword: encrypted }] }) };
  const controller = createAmcCustomerController({ pool });
  const res = createResponse();

  await controller.getRemotePassword(
    { user: { role: "Dispatcher" }, params: { customerId: "7" } },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { password: "secret" });
  assert.equal(res.headers["Cache-Control"], "no-store");
});

test("assigned engineer can reveal the ticket remote password", async () => {
  const encrypted = encryptRemotePassword("engineer secret");
  const pool = {
    query: async () => ({
      rows: [{ AssignedTo: "engineer@example.com", RemotePassword: encrypted }]
    })
  };
  const controller = createAmcCustomerController({ pool });
  const res = createResponse();

  await controller.getTicketRemotePassword(
    {
      user: { role: "Engineer", email: "engineer@example.com" },
      params: { ticketId: "10" }
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { password: "engineer secret" });
});

test("unassigned engineer cannot reveal the ticket remote password", async () => {
  const encrypted = encryptRemotePassword("engineer secret");
  const pool = {
    query: async () => ({
      rows: [{ AssignedTo: "assigned@example.com", RemotePassword: encrypted }]
    })
  };
  const controller = createAmcCustomerController({ pool });
  const res = createResponse();

  await controller.getTicketRemotePassword(
    {
      user: { role: "Engineer", email: "different@example.com" },
      params: { ticketId: "10" }
    },
    res
  );

  assert.equal(res.statusCode, 403);
});

test("manager cannot reveal a ticket remote password", async () => {
  const encrypted = encryptRemotePassword("engineer secret");
  const pool = {
    query: async () => ({
      rows: [{ AssignedTo: "assigned@example.com", RemotePassword: encrypted }]
    })
  };
  const controller = createAmcCustomerController({ pool });
  const res = createResponse();

  await controller.getTicketRemotePassword(
    { user: { role: "Manager", email: "manager@example.com" }, params: { ticketId: "10" } },
    res
  );

  assert.equal(res.statusCode, 403);
});
