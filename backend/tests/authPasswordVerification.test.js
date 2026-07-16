const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcrypt");

const { verifyStoredPassword } = require("../routes/authRoutes");

test("verifies bcrypt passwords and rejects incorrect passwords", async () => {
  const hash = await bcrypt.hash("correct-password", 10);

  assert.equal(await verifyStoredPassword("correct-password", hash), true);
  assert.equal(await verifyStoredPassword("wrong-password", hash), false);
});

test("only accepts the exact legacy first-login password", async () => {
  assert.equal(await verifyStoredPassword("12345", "12345"), true);
  assert.equal(await verifyStoredPassword("anything", "12345"), false);
});
