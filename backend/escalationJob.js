const pool = require("./db");

async function runEscalationJob() {
  try {
    await pool.query(`
      UPDATE "Tickets"
      SET "Escalated" = true,
          "Status" = 'Escalated'
      WHERE "Status" = 'Open'
        AND NOW() - "CreatedTime" >= INTERVAL '4 hours'
        AND "Escalated" = false
    `);

    console.log("⏰ Escalation Job Completed");
  } catch (err) {
    console.error("Escalation Job Error:", err);
  }
}

module.exports = runEscalationJob;
