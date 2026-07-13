const ALLOWED_PRIORITIES = new Set(["High", "Medium", "Low"]);

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validateManagerNotification(input = {}) {
  const data = {
    customerName: cleanText(input.customerName),
    siteName: cleanText(input.siteName),
    issueDetails: cleanText(input.issueDetails),
    priority: cleanText(input.priority) || "Medium"
  };
  const errors = [];

  if (!data.customerName) errors.push("Customer Name is required");
  if (!data.siteName) errors.push("Site Name is required");
  if (!data.issueDetails) errors.push("Issue Details are required");
  if (data.customerName.length > 255) errors.push("Customer Name must be 255 characters or fewer");
  if (data.siteName.length > 255) errors.push("Site Name must be 255 characters or fewer");
  if (data.issueDetails.length > 5000) errors.push("Issue Details must be 5000 characters or fewer");
  if (!ALLOWED_PRIORITIES.has(data.priority)) errors.push("Priority must be High, Medium, or Low");

  return { data, errors };
}

module.exports = { ALLOWED_PRIORITIES, validateManagerNotification };
