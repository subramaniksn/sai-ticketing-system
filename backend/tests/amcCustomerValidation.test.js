const test = require("node:test");
const assert = require("node:assert/strict");

const { validateAmcCustomer } = require("../validation/amcCustomerValidation");

test("trims AMC text fields", () => {
  const result = validateAmcCustomer({
    customerName: "  Example Energy  ",
    siteName: "  Site One ",
    systemName: "  SCADA Server 1  ",
    remoteTool: "AnyDesk"
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.data.customerName, "Example Energy");
  assert.equal(result.data.siteName, "Site One");
  assert.equal(result.data.systemName, "SCADA Server 1");
});

test("rejects invalid phone and remote tool", () => {
  const result = validateAmcCustomer({
    customerName: "Example Energy",
    siteName: "Site One",
    systemName: "SCADA Server 1",
    siteContactPhone: "123",
    remoteTool: "UnknownTool"
  });

  assert.equal(result.errors.length, 2);
});

test("requires a system name for each AMC remote system", () => {
  const result = validateAmcCustomer({
    customerName: "Example Energy",
    siteName: "Site One",
    systemName: "   ",
    remoteTool: "AnyDesk"
  });

  assert.ok(result.errors.includes("System Name is required"));
});
