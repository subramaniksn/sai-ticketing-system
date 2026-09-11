const express = require("express");
const router = express.Router();
const pool = require("../db");
const verifyToken = require("../middleware/authMiddleware");
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const { createAmcCustomerController } = require("../controllers/amcCustomerController");
const { createTicketStatusController } = require("../controllers/ticketStatusController");
const { validateManagerNotification } = require("../validation/managerNotificationValidation");

// Microsoft 365 email notifications
const {
  notifyDispatcherManagerAlert,
  notifyEngineerTicketAssigned
} = require("../emailService");
const { sendManagerWhatsApp } = require("../whatsappService");
const {
  createAmcCustomer,
  updateAmcCustomer,
  getAmcCustomers,
  getRemotePassword,
  getTicketRemotePassword
} = createAmcCustomerController({ pool });
const { updateTicketStatus } = createTicketStatusController({ pool, sendManagerWhatsApp });

// Kept separate from Tickets so every follow-up remains visible after resolution.
async function ensureTicketCommentsTable() {
  await pool.query(`CREATE TABLE IF NOT EXISTS "TicketComments" (
    "CommentID" SERIAL PRIMARY KEY,
    "TicketID" INTEGER NOT NULL REFERENCES "Tickets"("TicketID") ON DELETE CASCADE,
    "Comment" TEXT NOT NULL,
    "UpdateType" VARCHAR(30) NOT NULL,
    "CreatedBy" VARCHAR(255) NOT NULL,
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
}

// ✅ Generate Ticket No Function (PostgreSQL)
async function generateTicketNo() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  
  const result = await pool.query(
    `SELECT COUNT(*) AS total
     FROM "Tickets"
     WHERE "TicketNo" LIKE $1`,
    [`SAI-${year}-${month}%`]
  );

  const count = parseInt(result.rows[0].total) + 1;
  const serial = String(count).padStart(3, "0");

  return `SAI-${year}-${month}-${serial}`;
}


// Dispatcher creates a ticket and the assigned engineer is notified by email.
router.post("/create", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "Dispatcher") {
      return res.status(403).json({ msg: "Only Dispatcher can create tickets" });
    }

    let {
      customerName,
      siteName,
      issueDetails,
      priority,
      assignedTo,
      amcCustomerId,
      ticketType,
      sourceNotificationId
    } = req.body;

    const ticketNo = await generateTicketNo();

    // 🔥 AMC Lookup
    if (ticketType === "AMC" && amcCustomerId) {
      const amcResult = await pool.query(
        `SELECT "CustomerName", "SiteName"
         FROM "AMCCustomers"
         WHERE "CustomerID" = $1`,
        [amcCustomerId]
      );

      if (amcResult.rows.length > 0) {
        customerName = amcResult.rows[0].CustomerName;
        siteName = amcResult.rows[0].SiteName;
      } else {
        return res.status(400).json({ msg: "AMC Customer not found" });
      }
    }

        await pool.query(
          `INSERT INTO "Tickets"
          ("TicketNo","CustomerName","SiteName","IssueDetails","priority",
            "AssignedTo","AmcCustomerId","TicketType","Status",
            "ReminderSent","EscalationSent","SourceNotificationId")
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Open',false,false,$9)`,
          [
            ticketNo,
            customerName,
            siteName,
            issueDetails,
            priority || "Medium",
            assignedTo,
            amcCustomerId || null,
            ticketType || "NON_AMC",
            sourceNotificationId || null
          ]
        );

    // Fetch the engineer and send the assignment email.
    try {
      const engRes = await pool.query(
        `SELECT "Email" FROM public."Users" WHERE "Email" = $1`,
        [assignedTo]
      );
      const engineer = engRes.rows[0];

      if (engineer?.Email) {
        const createdTimeIST = new Date().toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour12: true,
          year: 'numeric', month: 'short', day: '2-digit',
          hour: '2-digit', minute: '2-digit'
        });

        // Fire-and-forget — never blocks the API response
        notifyEngineerTicketAssigned(
          engineer.Email,
          {
            ticketNo,
            customerName,
            siteName,
            issueDetails,
            priority: priority || 'Medium',
            createdTime: createdTimeIST
          }
        ).catch(err => console.error('Assignment email error:', err.message));

      } else {
        console.warn(`Engineer email not found for ${assignedTo}; assignment email skipped`);
      }
    } catch (emailError) {
      // Email failure must never break ticket creation.
      console.error('Assignment email lookup error:', emailError.message);
    }

    res.json({ msg: "Ticket Created Successfully", ticketNo });

  } catch (err) {
    console.error("Create ticket error:", err);
    res.status(500).json({ msg: "Server Error" });
  }
});


// ✅ Dispatcher View All Tickets
router.get("/all", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "Dispatcher") {
      return res.status(403).json({ msg: "Access Denied" });
    }

    const result = await pool.query(
      `SELECT
        t."TicketID",
        t."TicketNo",
        t."CustomerName",
        t."SiteName",
        t."IssueDetails",
        t."AssignedTo",
        t."Status",
        t."Remark",
        t."CreatedTime"::timestamptz AT TIME ZONE 'Asia/Kolkata' AS "CreatedTime",
        t."ResolvedTime"::timestamptz AT TIME ZONE 'Asia/Kolkata' AS "ResolvedTime",
        t."Escalated",
        t."InProgress_Date"::timestamptz AT TIME ZONE 'Asia/Kolkata' AS "InProgress_Date",
        t."Pending_Date"::timestamptz AT TIME ZONE 'Asia/Kolkata' AS "Pending_Date",
        t."Resolved_Date"::timestamptz AT TIME ZONE 'Asia/Kolkata' AS "Resolved_Date",
        t."priority",
        t."AmcCustomerId",
        t."TicketType",
        a."SystemName",
        a."SiteContactName",
        a."SiteContactPhone",
        a."RemoteTool",
        a."RemoteID",
        (a."RemotePassword" IS NOT NULL AND a."RemotePassword" <> '') AS "HasRemotePassword"
      FROM "Tickets" t
      LEFT JOIN "AMCCustomers" a
        ON a."CustomerID" = t."AmcCustomerId"
      ORDER BY t."CreatedTime"::timestamptz AT TIME ZONE 'Asia/Kolkata' DESC;`
    );

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Failed to load tickets" });
  }
});

// AMC customer management
router.post("/amc/create", verifyToken, createAmcCustomer);
router.put("/amc/:customerId", verifyToken, updateAmcCustomer);
router.get("/amc", verifyToken, getAmcCustomers);
router.get("/amc/:customerId/remote-password", verifyToken, getRemotePassword);
router.get("/ticket/:ticketId/remote-password", verifyToken, getTicketRemotePassword);

router.get("/ticket/:id/comments", verifyToken, async (req, res) => {
  const ticketId = Number(req.params.id);
  if (!Number.isInteger(ticketId) || ticketId <= 0) return res.status(400).json({ msg: "Invalid ticket ID" });
  try {
    await ensureTicketCommentsTable();
    const ticket = await pool.query(
      `SELECT "AssignedTo" FROM "Tickets" WHERE "TicketID" = $1`, [ticketId]
    );
    if (!ticket.rows.length) return res.status(404).json({ msg: "Ticket not found" });
    if (req.user.role === "Engineer" && ticket.rows[0].AssignedTo !== req.user.email) {
      return res.status(403).json({ msg: "Access denied" });
    }
    if (!["Engineer", "Dispatcher", "Manager"].includes(req.user.role)) {
      return res.status(403).json({ msg: "Access denied" });
    }
    const result = await pool.query(
      `SELECT "CommentID", "Comment", "UpdateType", "CreatedBy", "CreatedAt"
       FROM "TicketComments" WHERE "TicketID" = $1 ORDER BY "CreatedAt" ASC`, [ticketId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error("Load ticket comments error:", err);
    return res.status(500).json({ msg: "Failed to load work updates" });
  }
});


// ✅ Engineer My Tickets
router.get("/mytickets", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "Engineer") {
      return res.status(403).json({ msg: "Only Engineers allowed" });
    }

    const result = await pool.query(
      `SELECT
        t."TicketID",
        t."TicketNo",
        t."CustomerName",
        t."SiteName",
        t."IssueDetails",
        t."AssignedTo",
        t."Status",
        t."Remark",
        t."CreatedTime"::timestamptz AT TIME ZONE 'Asia/Kolkata' AS "CreatedTime",
        t."ResolvedTime"::timestamptz AT TIME ZONE 'Asia/Kolkata' AS "ResolvedTime",
        t."Escalated",
        t."InProgress_Date"::timestamptz AT TIME ZONE 'Asia/Kolkata' AS "InProgress_Date",
        t."Pending_Date"::timestamptz AT TIME ZONE 'Asia/Kolkata' AS "Pending_Date",
        t."Resolved_Date"::timestamptz AT TIME ZONE 'Asia/Kolkata' AS "Resolved_Date",
        t."priority",
        t."AmcCustomerId",
        t."TicketType",
        a."SystemName",
        a."SiteContactName",
        a."SiteContactPhone",
        a."RemoteTool",
        a."RemoteID",
        (a."RemotePassword" IS NOT NULL AND a."RemotePassword" <> '') AS "HasRemotePassword"
      FROM "Tickets" t
      LEFT JOIN "AMCCustomers" a
        ON a."CustomerID" = t."AmcCustomerId"
      WHERE t."AssignedTo" = $1
      ORDER BY t."CreatedTime"::timestamptz AT TIME ZONE 'Asia/Kolkata' DESC`,
      [req.user.email]
    );

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Failed to load tickets" });
  }
});

router.post("/ticket/:id/comment", verifyToken, async (req, res) => {
  if (req.user.role !== "Engineer") return res.status(403).json({ msg: "Only Engineers allowed" });
  const ticketId = Number(req.params.id);
  const comment = typeof req.body?.comment === "string" ? req.body.comment.trim() : "";
  const updateType = ["Started work", "Waiting for customer", "Follow-up"].includes(req.body?.updateType)
    ? req.body.updateType : "Follow-up";
  if (!Number.isInteger(ticketId) || ticketId <= 0 || !comment) {
    return res.status(400).json({ msg: "A work update is required" });
  }
  try {
    await ensureTicketCommentsTable();
    const result = await pool.query(
      `INSERT INTO "TicketComments" ("TicketID", "Comment", "UpdateType", "CreatedBy")
      SELECT "TicketID", $1, $2, $3::varchar
      FROM "Tickets"
      WHERE "TicketID" = $4 AND "AssignedTo" = $3::varchar AND "Status" <> 'Resolved'`,
      [comment, updateType, req.user.email, ticketId]
    );
    if (!result.rowCount) return res.status(404).json({ msg: "Active assigned ticket not found" });
    return res.status(201).json({ msg: "Work update saved" });
  } catch (err) {
    console.error("Save ticket comment error:", err);
    return res.status(500).json({ msg: "Failed to save work update" });
  }
});


// ✅ Update Status
router.put("/update-status/:id", verifyToken, updateTicketStatus);


// ✅ Resolve Ticket
router.put("/resolve/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "Engineer") {
      return res.status(403).json({ msg: "Only Engineers allowed" });
    }

    const ticketId = req.params.id;
    const { remark } = req.body;

    if (!remark) {
      return res.status(400).json({ msg: "Remark required" });
    }

    const result = await pool.query(
      `UPDATE "Tickets"
      SET "Status"='Resolved',
          "Resolved_Date"=NOW(),
          "Remark"=$1
      WHERE "TicketID"=$2
        AND "AssignedTo"=$3
        AND "Status" IN ('InProgress','Pending')`,
      [remark, ticketId, req.user.email]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ msg: "Ticket must be InProgress or Pending" });
    }

    await ensureTicketCommentsTable();
    await pool.query(
      `INSERT INTO "TicketComments" ("TicketID", "Comment", "UpdateType", "CreatedBy")
       VALUES ($1, $2, 'Resolved', $3)`,
      [ticketId, remark.trim(), req.user.email]
    );

    res.json({ msg: "Ticket Resolved Successfully ✅" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Failed to resolve ticket" });
  }
});


// ✅ Manager View All
router.get("/escalated", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "Manager") {
      return res.status(403).json({ msg: "Only Managers allowed" });
    }

    const result = await pool.query(
      `SELECT
        t."TicketID",
        t."TicketNo",
        t."CustomerName",
        t."SiteName",
        t."IssueDetails",
        t."AssignedTo",
        t."Status",
        t."Remark",
        t."CreatedTime"::timestamptz AT TIME ZONE 'Asia/Kolkata' AS "CreatedTime",
        t."ResolvedTime"::timestamptz AT TIME ZONE 'Asia/Kolkata' AS "ResolvedTime",
        t."Escalated",
        t."InProgress_Date"::timestamptz AT TIME ZONE 'Asia/Kolkata' AS "InProgress_Date",
        t."Pending_Date"::timestamptz AT TIME ZONE 'Asia/Kolkata' AS "Pending_Date",
        t."Resolved_Date"::timestamptz AT TIME ZONE 'Asia/Kolkata' AS "Resolved_Date",
        t."priority",
        t."AmcCustomerId",
        t."TicketType",
        a."SystemName",
        a."SiteContactName",
        a."SiteContactPhone",
        a."RemoteTool",
        a."RemoteID",
        (a."RemotePassword" IS NOT NULL AND a."RemotePassword" <> '') AS "HasRemotePassword"
      FROM "Tickets" t
      LEFT JOIN "AMCCustomers" a
        ON a."CustomerID" = t."AmcCustomerId"
      ORDER BY t."CreatedTime"::timestamptz AT TIME ZONE 'Asia/Kolkata' DESC`
    );

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Failed to load tickets" });
  }
});


// ✅ Download CSV
const { Parser } = require('json2csv');

router.get("/download", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "Manager") {
      return res.status(403).json({ msg: "Only Managers can download ticket reports" });
    }

    const { startDate, endDate } = req.query;
    const validDate = value => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
      const date = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    };
    if ((startDate && !endDate) || (!startDate && endDate)) {
      return res.status(400).json({ msg: "Both start date and end date are required" });
    }
    if (startDate && (!validDate(startDate) || !validDate(endDate))) {
      return res.status(400).json({ msg: "Dates must use a valid YYYY-MM-DD format" });
    }
    if (startDate && startDate > endDate) {
      return res.status(400).json({ msg: "Start date cannot be after end date" });
    }

    let query = `
      SELECT 
        "TicketID",
        "TicketNo",
        "CustomerName",
        "SiteName",
        "IssueDetails",
        "AssignedTo",
        "Status",
        "Remark",
        COALESCE(("CreatedTime"::timestamptz AT TIME ZONE 'Asia/Kolkata')::text, '') as "CreatedTime",
   	COALESCE(("ResolvedTime"::timestamptz AT TIME ZONE 'Asia/Kolkata')::text, '') as "ResolvedTime",
	CASE WHEN "Escalated" THEN 'Yes' ELSE 'No' END as "Escalated",
	COALESCE(("InProgress_Date"::timestamptz AT TIME ZONE 'Asia/Kolkata')::text, '') as "InProgress_Date",
	COALESCE(("Pending_Date"::timestamptz AT TIME ZONE 'Asia/Kolkata')::text, '') as "Pending_Date",
	COALESCE(("Resolved_Date"::timestamptz AT TIME ZONE 'Asia/Kolkata')::text, '') as "Resolved_Date",
        "priority",
        COALESCE("AmcCustomerId"::text, '') as "AmcCustomerId",
        "TicketType"
      FROM "Tickets"
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (startDate && endDate) {
      query += ` AND ("CreatedTime"::timestamptz AT TIME ZONE 'Asia/Kolkata')::date
                     BETWEEN $${paramIndex}::date AND $${paramIndex + 1}::date`;
      params.push(startDate);
      params.push(endDate);
      paramIndex += 2;
    }

    if (req.query.customer && typeof req.query.customer !== "string") {
      return res.status(400).json({ msg: "Customer filter must be text" });
    }
    if (typeof req.query.customer === "string" && req.query.customer.trim().length > 255) {
      return res.status(400).json({ msg: "Customer filter is too long" });
    }
    if (req.query.customer && req.query.customer !== '') {
      query += ` AND lower(btrim("CustomerName")) = lower($${paramIndex})`;
      params.push(req.query.customer.trim());
      paramIndex++;
    }

    query += ` ORDER BY "CreatedTime" DESC`;

    const result = await pool.query(query, params);

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ msg: "No tickets found for the selected report filters" });
    }

    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(result.rows);

    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.attachment(`SAI_Tickets_${req.query.startDate || 'all'}_to_${req.query.endDate || 'all'}.csv`);
    return res.send(csv);

  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ msg: "Failed to download tickets" });
  }
});

// ✅ Reassign Ticket
router.put("/reassign/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "Dispatcher") {
      return res.status(403).json({ msg: "Only Dispatcher can reassign" });
    }

    const { assignedTo } = req.body;

    // ✅ Get ticket details before update
    const ticketRes = await pool.query(
      `SELECT "TicketNo", "CustomerName", "SiteName", "IssueDetails", "priority"
       FROM "Tickets" WHERE "TicketID" = $1`,
      [req.params.id]
    );

    await pool.query(
      `UPDATE "Tickets"
       SET "AssignedTo" = $1,
           "ReminderSent" = false,
           "EscalationSent" = false
       WHERE "TicketID" = $2`,
      [assignedTo, req.params.id]
    );

    // Send an email to the newly assigned engineer.
    try {
      const engRes = await pool.query(
        `SELECT "Email" FROM public."Users" WHERE "Email" = $1`,
        [assignedTo]
      );
      const engineer = engRes.rows[0];
      const ticket = ticketRes.rows[0];

      if (engineer?.Email && ticket) {
        const assignedTimeIST = new Date().toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour12: true,
          year: 'numeric', month: 'short', day: '2-digit',
          hour: '2-digit', minute: '2-digit'
        });

        notifyEngineerTicketAssigned(
          engineer.Email,
          {
            ticketNo: ticket.TicketNo,
            customerName: ticket.CustomerName,
            siteName: ticket.SiteName,
            issueDetails: ticket.IssueDetails,
            priority: ticket.priority,
            createdTime: assignedTimeIST
          }
        ).catch(err => console.error('Reassignment email error:', err.message));

        console.log(`Reassignment email queued for ${assignedTo}`);
      }
    } catch (emailError) {
      console.error('Reassignment email error:', emailError.message);
    }

    res.json({ msg: "✅ Ticket reassigned successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error updating ticket" });
  }
});


// ✅ GET Engineers List
router.get("/users/engineers", verifyToken, async (req, res) => {
  try {
    if (!["Dispatcher", "Manager"].includes(req.user.role)) {
      return res.status(403).json({ msg: "Access denied" });
    }

    const result = await pool.query(`
      SELECT "Email" 
      FROM public."Users" 
      WHERE "Role" = 'Engineer'
      ORDER BY "UserID" ASC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Failed to fetch engineers" });
  }
});

// ✅ Manager Send Notification to Dispatcher
router.post("/manager-notify", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "Manager") {
      return res.status(403).json({ msg: "Only Manager allowed" });
    }

    const { data, errors } = validateManagerNotification(req.body);
    if (errors.length) {
      return res.status(400).json({ msg: errors[0], errors });
    }
    const { customerName, siteName, issueDetails, priority } = data;

    // 1️⃣ Save notification in DB
    await pool.query(
      `INSERT INTO "ManagerNotifications"
       ("CustomerName", "SiteName", "IssueDetails", "Priority", "SentBy")
       VALUES ($1, $2, $3, $4, $5)`,
      [customerName, siteName, issueDetails, priority, req.user.email]
    );

    // Send the manager alert to all dispatchers by email.
    try {
      const dispatcherRes = await pool.query(
        `SELECT "Email" FROM public."Users" WHERE "Role" = 'Dispatcher'`
      );

      const dispatcherEmails = dispatcherRes.rows
        .map((dispatcher) => dispatcher.Email)
        .filter(Boolean);

      if (dispatcherEmails.length) {
        await notifyDispatcherManagerAlert(dispatcherEmails, {
          sentBy: req.user.email,
          customerName,
          siteName,
          priority,
          issueDetails
        });
        console.log("Manager alert emailed to dispatchers");
      } else {
        console.log("Dispatcher email not found");
      }

    } catch (emailError) {
      console.error("Manager alert email error:", emailError.message);
    }

    res.status(201).json({ msg: "✅ Notification sent to Dispatcher!" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Failed to send notification" });
  }
});

// ✅ Dispatcher Get Manager Notifications
router.get("/manager-notifications", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "Dispatcher") {
      return res.status(403).json({ msg: "Only Dispatcher allowed" });
    }

    const result = await pool.query(
      `SELECT "NotificationID", "CustomerName", "SiteName", "IssueDetails", "Priority", "SentBy", "Status", "TicketProgress",
              "CreatedAt"::timestamptz AT TIME ZONE 'Asia/Kolkata' AS "CreatedAt"
       FROM "ManagerNotifications"
       ORDER BY "CreatedAt" DESC`
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Failed to fetch notifications" });
  }
});

// The manager can see every alert they created until the dispatcher closes it.
router.get("/manager-notifications/mine", verifyToken, async (req, res) => {
  if (req.user.role !== "Manager") return res.status(403).json({ msg: "Only Manager allowed" });
  try {
    const result = await pool.query(
      `SELECT "NotificationID", "CustomerName", "SiteName", "IssueDetails", "Priority", "SentBy", "Status", "TicketProgress",
              "CreatedAt"::timestamptz AT TIME ZONE 'Asia/Kolkata' AS "CreatedAt"
       FROM "ManagerNotifications" WHERE "SentBy" = $1 ORDER BY "CreatedAt" DESC`,
      [req.user.email]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error("Load manager notifications error:", err);
    return res.status(500).json({ msg: "Failed to fetch notifications" });
  }
});

// ✅ Dispatcher Mark Notification as Done
router.put("/manager-notify/:id/done", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "Dispatcher") {
      return res.status(403).json({ msg: "Only Dispatcher allowed" });
    }

    const result = await pool.query(
      `UPDATE "ManagerNotifications" SET "Status" = 'done' WHERE "NotificationID" = $1
       RETURNING "CustomerName", "SiteName", "SentBy"`,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ msg: "Notification not found" });
    }

    let whatsappSent = false;
    try {
      const manager = await pool.query(`SELECT "Phone" FROM "Users" WHERE "Email" = $1`, [result.rows[0].SentBy]);
      const alert = result.rows[0];
      const delivery = await sendManagerWhatsApp(
        manager.rows[0]?.Phone,
        `Dispatcher update: your alert for ${alert.CustomerName} — ${alert.SiteName} has been completed.`
      );
      whatsappSent = delivery.sent;
    } catch (whatsappError) {
      // A delivery problem must not prevent the dispatcher from completing the alert.
      console.error("Manager WhatsApp notification error:", whatsappError.message);
    }

    res.json({ msg: "✅ Marked as done", whatsappSent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Failed to update" });
  }
});
module.exports = router;
