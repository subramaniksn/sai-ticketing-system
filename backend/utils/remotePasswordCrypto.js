const crypto = require("crypto");

const ENCRYPTION_PREFIX = "enc:v1:";
const ALGORITHM = "aes-256-gcm";

function getEncryptionKey(keyValue = process.env.REMOTE_PASSWORD_ENCRYPTION_KEY) {
  if (!keyValue) {
    const error = new Error("REMOTE_PASSWORD_ENCRYPTION_KEY is not configured");
    error.code = "AMC_ENCRYPTION_KEY_MISSING";
    throw error;
  }

  const key = Buffer.from(keyValue, "base64");
  if (key.length !== 32) {
    const error = new Error("REMOTE_PASSWORD_ENCRYPTION_KEY must be a 32-byte base64 value");
    error.code = "AMC_ENCRYPTION_KEY_INVALID";
    throw error;
  }

  return key;
}

function isEncryptedRemotePassword(value) {
  return typeof value === "string" && value.startsWith(ENCRYPTION_PREFIX);
}

function encryptRemotePassword(value, keyValue) {
  if (value === undefined || value === null || value === "") return null;

  const key = getEncryptionKey(keyValue);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(String(value), "utf8"),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTION_PREFIX}${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

function decryptRemotePassword(value, keyValue) {
  if (value === undefined || value === null || value === "") return null;
  if (!isEncryptedRemotePassword(value)) {
    const error = new Error("Remote password has not been migrated to encrypted storage");
    error.code = "AMC_PASSWORD_NOT_ENCRYPTED";
    throw error;
  }

  const key = getEncryptionKey(keyValue);
  const payload = value.slice(ENCRYPTION_PREFIX.length).split(":");
  if (payload.length !== 3) {
    const error = new Error("Encrypted remote password has an invalid format");
    error.code = "AMC_PASSWORD_INVALID_FORMAT";
    throw error;
  }

  try {
    const [iv, authTag, encrypted] = payload.map(part => Buffer.from(part, "base64"));
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch (cause) {
    const error = new Error("Remote password could not be decrypted");
    error.code = "AMC_PASSWORD_DECRYPTION_FAILED";
    error.cause = cause;
    throw error;
  }
}

module.exports = {
  decryptRemotePassword,
  encryptRemotePassword,
  getEncryptionKey,
  isEncryptedRemotePassword
};
