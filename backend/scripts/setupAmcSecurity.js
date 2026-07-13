const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env");
require("dotenv").config({ path: envPath });

const pool = require("../db");
const {
  encryptRemotePassword,
  getEncryptionKey,
  isEncryptedRemotePassword
} = require("../utils/remotePasswordCrypto");

function ensureEncryptionKey() {
  if (process.env.REMOTE_PASSWORD_ENCRYPTION_KEY) {
    getEncryptionKey();
    return false;
  }

  const key = crypto.randomBytes(32).toString("base64");
  const current = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const separator = current && !current.endsWith("\n") ? "\n" : "";
  fs.appendFileSync(envPath, `${separator}REMOTE_PASSWORD_ENCRYPTION_KEY=${key}\n`, {
    encoding: "utf8",
    mode: 0o600
  });
  process.env.REMOTE_PASSWORD_ENCRYPTION_KEY = key;
  return true;
}

async function setupAmcSecurity() {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    const encryptedPasswords = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM "AMCCustomers"
       WHERE "RemotePassword" LIKE 'enc:v1:%'`
    );
    if (!process.env.REMOTE_PASSWORD_ENCRYPTION_KEY && encryptedPasswords.rows[0].count > 0) {
      throw new Error(
        "Encrypted AMC passwords already exist. Copy the existing REMOTE_PASSWORD_ENCRYPTION_KEY into backend/.env before running this setup."
      );
    }

    const createdKey = ensureEncryptionKey();
    await client.query("BEGIN");
    transactionStarted = true;

    const duplicates = await client.query(
      `SELECT lower(btrim("CustomerName")) AS customer,
              lower(btrim("SiteName")) AS site,
              COUNT(*)::int AS count
       FROM "AMCCustomers"
       GROUP BY 1, 2
       HAVING COUNT(*) > 1`
    );
    if (duplicates.rows.length) {
      throw new Error("Duplicate AMC customer/site records must be resolved before enabling the unique index");
    }

    await client.query(
      `ALTER TABLE "AMCCustomers"
       ALTER COLUMN "RemotePassword" TYPE TEXT`
    );
    await client.query(
      `CREATE SEQUENCE IF NOT EXISTS "AMCCustomers_CustomerID_seq"`
    );
    await client.query(
      `SELECT setval(
         '"AMCCustomers_CustomerID_seq"'::regclass,
         COALESCE(MAX("CustomerID"), 1),
         MAX("CustomerID") IS NOT NULL
       )
       FROM "AMCCustomers"`
    );
    await client.query(
      `ALTER TABLE "AMCCustomers"
       ALTER COLUMN "CustomerID"
       SET DEFAULT nextval('"AMCCustomers_CustomerID_seq"'::regclass)`
    );
    await client.query(
      `ALTER SEQUENCE "AMCCustomers_CustomerID_seq"
       OWNED BY "AMCCustomers"."CustomerID"`
    );
    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UX_AMCCustomers_Customer_Site_CI"
       ON "AMCCustomers" (lower(btrim("CustomerName")), lower(btrim("SiteName")))`
    );

    const passwordRows = await client.query(
      `SELECT "CustomerID", "RemotePassword"
       FROM "AMCCustomers"
       WHERE "RemotePassword" IS NOT NULL AND "RemotePassword" <> ''
       FOR UPDATE`
    );

    let migratedPasswords = 0;
    for (const row of passwordRows.rows) {
      if (isEncryptedRemotePassword(row.RemotePassword)) continue;
      await client.query(
        `UPDATE "AMCCustomers"
         SET "RemotePassword" = $1
         WHERE "CustomerID" = $2`,
        [encryptRemotePassword(row.RemotePassword), row.CustomerID]
      );
      migratedPasswords += 1;
    }

    await client.query("COMMIT");
    transactionStarted = false;
    console.log(`AMC security setup complete. Key created: ${createdKey ? "yes" : "no"}. Passwords migrated: ${migratedPasswords}.`);
  } catch (err) {
    if (transactionStarted) await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

setupAmcSecurity().catch(err => {
  console.error("AMC security setup failed:", err.message);
  process.exitCode = 1;
});
