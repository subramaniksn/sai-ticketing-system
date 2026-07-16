const test = require("node:test");
const assert = require("node:assert/strict");

const { validateNewUser } = require("../validation/userValidation");

test("normalizes and accepts a valid new user", () => {
  const result = validateNewUser({
    role: "Engineer",
    email: "  Engineer@Example.com ",
    phone: "+91 98765 43210",
    temporaryPassword: "temporary-secret"
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.data.email, "engineer@example.com");
});

test("rejects invalid role, email, phone, and temporary password", () => {
  const result = validateNewUser({
    role: "Admin",
    email: "invalid",
    phone: "123",
    temporaryPassword: "short"
  });

  assert.equal(result.errors.length, 4);
});
