const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
const verifyToken = require("../middleware/authMiddleware");

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

test("rejects first-login tokens from protected APIs", () => {
  const token = jwt.sign(
    { purpose: "first-login", id: 7, email: "user@example.com" },
    process.env.JWT_SECRET
  );
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = createResponse();

  verifyToken(req, res, () => assert.fail("next should not be called"));

  assert.equal(res.statusCode, 401);
});

test("accepts normal access tokens", () => {
  const token = jwt.sign(
    { id: 7, email: "user@example.com", role: "Engineer" },
    process.env.JWT_SECRET
  );
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = createResponse();
  let nextCalled = false;

  verifyToken(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(req.user.role, "Engineer");
});
