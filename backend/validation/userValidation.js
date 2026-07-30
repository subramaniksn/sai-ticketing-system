const ALLOWED_USER_ROLES = new Set(["Dispatcher", "Engineer", "Manager"]);

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validateNewUser(input = {}) {
  const data = {
    role: cleanText(input.role),
    email: cleanText(input.email).toLowerCase(),
    phone: cleanText(input.phone),
    temporaryPassword: typeof input.temporaryPassword === "string"
      ? input.temporaryPassword
      : ""
  };
  const errors = [];

  if (!ALLOWED_USER_ROLES.has(data.role)) {
    errors.push("Role must be Dispatcher, Engineer, or Manager");
  }
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push("A valid email address is required");
  }
  if (data.email.length > 255) errors.push("Email must be 255 characters or fewer");

  const phoneDigits = data.phone.replace(/\D/g, "");
  if (!data.phone || phoneDigits.length < 10 || phoneDigits.length > 15 || !/^\+?[\d\s().-]+$/.test(data.phone)) {
    errors.push("Phone must contain 10 to 15 digits");
  }
  if (data.phone.length > 20) errors.push("Phone must be 20 characters or fewer");

  if (data.temporaryPassword.length < 8) {
    errors.push("Temporary Password must contain at least 8 characters");
  }
  if (data.temporaryPassword.length > 72) {
    errors.push("Temporary Password must contain 72 characters or fewer");
  }

  return { data, errors };
}

function validateTemporaryPassword(value) {
  if (typeof value !== "string" || value.length < 8 || value.length > 72) {
    return "Temporary Password must contain 8 to 72 characters";
  }
  return "";
}

module.exports = { ALLOWED_USER_ROLES, validateNewUser, validateTemporaryPassword };
