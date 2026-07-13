const test = require("node:test");
const assert = require("node:assert/strict");

const { validateManagerNotification } = require("../validation/managerNotificationValidation");

test("trims and accepts a valid manager notification", () => {
  const result = validateManagerNotification({
    customerName: "  Example Energy ",
    siteName: " Site One ",
    issueDetails: "  Inverter communication lost ",
    priority: "High"
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.data.customerName, "Example Energy");
  assert.equal(result.data.issueDetails, "Inverter communication lost");
});

test("rejects whitespace-only manager notification fields", () => {
  const result = validateManagerNotification({
    customerName: " ",
    siteName: " ",
    issueDetails: " "
  });

  assert.equal(result.errors.length, 3);
});

test("rejects an unsupported notification priority", () => {
  const result = validateManagerNotification({
    customerName: "Example Energy",
    siteName: "Site One",
    issueDetails: "Issue",
    priority: "Urgent"
  });

  assert.deepEqual(result.errors, ["Priority must be High, Medium, or Low"]);
});
