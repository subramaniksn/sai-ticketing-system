const test = require("node:test");
const assert = require("node:assert/strict");

const { validateAmcCustomer } = require("../validation/amcCustomerValidation");

test("trims AMC text fields", () => {
  const result = validateAmcCustomer({
    customerName: "  Example Energy  ",
    siteName: "  Site One ",
    remoteTool: "AnyDesk"
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.data.customerName, "Example Energy");
  assert.equal(result.data.siteName, "Site One");
});

test("rejects invalid phone and remote tool", () => {
  const result = validateAmcCustomer({
    customerName: "Example Energy",
    siteName: "Site One",
    siteContactPhone: "123",
    remoteTool: "UnknownTool"
  });

  assert.equal(result.errors.length, 2);
});
