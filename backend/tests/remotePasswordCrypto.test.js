const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

const {
  decryptRemotePassword,
  encryptRemotePassword,
  isEncryptedRemotePassword
} = require("../utils/remotePasswordCrypto");

test("encrypts and decrypts remote passwords", () => {
  const key = crypto.randomBytes(32).toString("base64");
  const encrypted = encryptRemotePassword("my password", key);

  assert.equal(isEncryptedRemotePassword(encrypted), true);
  assert.notEqual(encrypted, "my password");
  assert.equal(decryptRemotePassword(encrypted, key), "my password");
});

test("rejects plaintext values during decryption", () => {
  const key = crypto.randomBytes(32).toString("base64");
  assert.throws(() => decryptRemotePassword("plain text", key), {
    code: "AMC_PASSWORD_NOT_ENCRYPTED"
  });
});
