const ALLOWED_REMOTE_TOOLS = new Set(["AnyDesk", "UltraViewer", "TeamViewer"]);

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validateAmcCustomer(input = {}) {
  const data = {
    customerName: cleanText(input.customerName),
    siteName: cleanText(input.siteName),
    systemName: cleanText(input.systemName),
    siteContactName: cleanText(input.siteContactName),
    siteContactPhone: cleanText(input.siteContactPhone),
    remoteTool: cleanText(input.remoteTool),
    remoteId: cleanText(input.remoteId),
    remotePassword: typeof input.remotePassword === "string" ? input.remotePassword : ""
  };
  const errors = [];

  if (!data.customerName) errors.push("Customer Name is required");
  if (!data.siteName) errors.push("Site Name is required");
  if (!data.systemName) errors.push("System Name is required");
  if (data.customerName.length > 255) errors.push("Customer Name must be 255 characters or fewer");
  if (data.siteName.length > 255) errors.push("Site Name must be 255 characters or fewer");
  if (data.systemName.length > 100) errors.push("System Name must be 100 characters or fewer");
  if (data.siteContactName.length > 100) errors.push("Site Contact Name must be 100 characters or fewer");
  if (data.siteContactPhone.length > 20) errors.push("Site Contact Phone must be 20 characters or fewer");
  if (data.remoteId.length > 50) errors.push("Remote ID must be 50 characters or fewer");
  if (data.remotePassword.length > 255) errors.push("Remote Password must be 255 characters or fewer");

  if (data.siteContactPhone) {
    const digits = data.siteContactPhone.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15 || !/^\+?[\d\s().-]+$/.test(data.siteContactPhone)) {
      errors.push("Site Contact Phone must contain 10 to 15 digits");
    }
  }

  if (data.remoteTool && !ALLOWED_REMOTE_TOOLS.has(data.remoteTool)) {
    errors.push("Remote Tool must be AnyDesk, UltraViewer, or TeamViewer");
  }

  return { data, errors };
}

module.exports = { ALLOWED_REMOTE_TOOLS, validateAmcCustomer };
