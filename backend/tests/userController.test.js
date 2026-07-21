const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcrypt");

const { createUserController } = require("../controllers/userController");

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
  role: "Engineer",
  email: "engineer@example.com",
  phone: "+91 98765 43210",
  temporaryPassword: "temporary-secret"
};

test("rejects user creation by non-dispatchers", async () => {
  const pool = { query: async () => assert.fail("database should not be called") };
  const controller = createUserController({ pool });
  const res = createResponse();

  await controller.createUser({ user: { role: "Manager" }, body: validBody }, res);

  assert.equal(res.statusCode, 403);
});

test("rejects invalid new user details before querying the database", async () => {
  const pool = { query: async () => assert.fail("database should not be called") };
  const controller = createUserController({ pool });
  const res = createResponse();

  await controller.createUser({ user: { role: "Dispatcher" }, body: {} }, res);

  assert.equal(res.statusCode, 400);
  assert.ok(res.body.errors.length >= 4);
});

test("rejects duplicate user email addresses", async () => {
  const pool = { query: async () => ({ rows: [{ UserID: 2 }] }) };
  const controller = createUserController({ pool });
  const res = createResponse();

  await controller.createUser({ user: { role: "Dispatcher" }, body: validBody }, res);

  assert.equal(res.statusCode, 409);
});

test("creates a first-login user with a hashed temporary password", async () => {
  const calls = [];
  const pool = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return calls.length === 1
        ? { rows: [] }
        : { rows: [{ UserID: 7, Role: "Engineer", Email: validBody.email, Phone: validBody.phone, IsFirstLogin: true }] };
    }
  };
  const controller = createUserController({ pool });
  const res = createResponse();

  await controller.createUser({ user: { role: "Dispatcher" }, body: validBody }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.user.IsFirstLogin, true);
  assert.equal(await bcrypt.compare(validBody.temporaryPassword, calls[1].params[2]), true);
  assert.notEqual(calls[1].params[2], validBody.temporaryPassword);
});

test("user list never returns password hashes", async () => {
  const pool = {
    query: async () => ({ rows: [{ UserID: 7, Role: "Engineer", Email: validBody.email }] })
  };
  const controller = createUserController({ pool });
  const res = createResponse();

  await controller.getUsers({ user: { role: "Dispatcher" } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["Cache-Control"], "no-store");
  assert.equal(Object.hasOwn(res.body[0], "Password"), false);
});

test("reports an incomplete UserID sequence without exposing database row details", async () => {
  let callCount = 0;
  const pool = {
    query: async () => {
      callCount += 1;
      if (callCount === 1) return { rows: [] };
      const error = new Error("null value violates not-null constraint");
      error.code = "23502";
      error.column = "UserID";
      throw error;
    }
  };
  const passwordHasher = { hash: async () => "hashed-password" };
  const controller = createUserController({ pool, passwordHasher });
  const res = createResponse();

  await controller.createUser({ user: { role: "Dispatcher" }, body: validBody }, res);

  assert.equal(res.statusCode, 500);
  assert.match(res.body.msg, /setup:user-security/);
});
