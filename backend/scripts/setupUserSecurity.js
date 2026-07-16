require("dotenv").config();
const pool = require("../db");

async function setupUserSecurity() {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    const duplicates = await client.query(
      `SELECT lower(btrim("Email")) AS email, COUNT(*)::int AS count
       FROM "Users"
       GROUP BY 1
       HAVING COUNT(*) > 1`
    );
    if (duplicates.rows.length) {
      throw new Error("Duplicate user email records must be resolved before enabling the unique index");
    }

    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UX_Users_Email_CI"
       ON "Users" (lower(btrim("Email")))`
    );

    await client.query("COMMIT");
    transactionStarted = false;
    console.log("User security setup complete. Case-insensitive email uniqueness enabled.");
  } catch (err) {
    if (transactionStarted) await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

setupUserSecurity().catch((err) => {
  console.error("User security setup failed:", err.message);
  process.exitCode = 1;
});
