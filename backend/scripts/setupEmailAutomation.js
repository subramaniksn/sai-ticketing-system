require("dotenv").config();
const pool = require("../db");

async function setupEmailAutomation() {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    await client.query(
      `CREATE TABLE IF NOT EXISTS "EmailAutomationState" (
         "Key" text PRIMARY KEY,
         "Value" text NOT NULL,
         "UpdatedAt" timestamptz NOT NULL DEFAULT NOW()
       )`
    );
    await client.query(
      `CREATE TABLE IF NOT EXISTS "ProcessedSupportEmails" (
         "InternetMessageID" text PRIMARY KEY,
         "GraphMessageID" text,
         "SenderEmail" text,
         "Subject" text,
         "Outcome" text NOT NULL,
         "TicketID" integer REFERENCES "Tickets"("TicketID") ON DELETE SET NULL,
         "ProcessedAt" timestamptz NOT NULL DEFAULT NOW()
       )`
    );
    await client.query(
      `ALTER TABLE "Tickets"
       ADD COLUMN IF NOT EXISTS "RemoteConnectionScheduledAt" timestamptz`
    );
    await client.query(
      `INSERT INTO "EmailAutomationState" ("Key", "Value")
       VALUES ('automation_started_at', NOW()::text)
       ON CONFLICT ("Key") DO NOTHING`
    );
    await client.query(
      `INSERT INTO "EmailAutomationState" ("Key", "Value")
       SELECT 'last_polled_at', "Value"
       FROM "EmailAutomationState"
       WHERE "Key" = 'automation_started_at'
       ON CONFLICT ("Key") DO NOTHING`
    );

    await client.query("COMMIT");
    transactionStarted = false;
    console.log("Email automation setup complete. Only new messages from this point will be considered.");
  } catch (error) {
    if (transactionStarted) await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

setupEmailAutomation().catch((error) => {
  console.error("Email automation setup failed:", error.message);
  process.exitCode = 1;
});
