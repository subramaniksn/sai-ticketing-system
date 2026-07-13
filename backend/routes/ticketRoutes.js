const express = require("express");
const router = express.Router();
const pool = require("../db");
const verifyToken = require("../middleware/authMiddleware");
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const { createAmcCustomerController } = require("../controllers/amcCustomerController");
const { validateManagerNotification } = require("../validation/managerNotificationValidation");

// ✅ NEW: WhatsApp notification
const { notifyEngineerTicketCreated,sendWhatsApp } = require('../whatsappService');
const {
  createAmcCustomer,
  updateAmcCustomer,
  getAmcCustomers,
  getRemotePassword,
  getTicketRemotePassword
} = createAmcCustomerController({ pool });

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


// ✅ Dispatcher Create Ticket — WITH WhatsApp notification
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
      ticketType
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
        "ReminderSent","EscalationSent")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Open',false,false)`,
      [
        ticketNo,
        customerName,
        siteName,
        issueDetails,
        priority || "Medium",
        assignedTo,
        amcCustomerId || null,
        ticketType || "NON_AMC"
      ]
    );

    // ✅ Fetch engineer phone and send WhatsApp
    try {
      const engRes = await pool.query(
        `SELECT "Email", "Phone" FROM public."Users" WHERE "Email" = $1`,
        [assignedTo]
      );
      const engineer = engRes.rows[0];

      if (engineer?.Phone) {
        const engineerName = engineer.Email.split('@')[0];
        const createdTimeIST = new Date().toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour12: true,
          year: 'numeric', month: 'short', day: '2-digit',
          hour: '2-digit', minute: '2-digit'
        });

        // Fire-and-forget — never blocks the API response
        notifyEngineerTicketCreated(
          engineer.Phone,
          engineerName,
          {
            ticketNo,
            customerName,
            siteName,
            issueDetails,
            priority: priority || 'Medium',
            createdTime: createdTimeIST
          }
        ).catch(err => console.error('WhatsApp notify error:', err.message));

      } else {
        console.warn(`⚠️ No phone for ${assignedTo} — WhatsApp skipped`);
      }
    } catch (waErr) {
      // WhatsApp failure must never break ticket creation
      console.error('WhatsApp lookup error:', waErr.message);
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


// ✅ Update Status
router.put("/update-status/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "Engineer") {
      return res.status(403).json({ msg: "Only Engineers allowed" });
    }

    const ticketId = req.params.id;
    const { status } = req.body;

    let query = "";
    let values = [];

    if (status === "InProgress") {
      query = `
        UPDATE "Tickets"
        SET "Status"='InProgress',
            "InProgress_Date"=NOW()
        WHERE "TicketID"=$1
          AND "AssignedTo"=$2
          AND "Status"='Open'
      `;
      values = [ticketId, req.user.email];

    } else if (status === "Pending") {
      query = `
        UPDATE "Tickets"
        SET "Status"='Pending',
            "Pending_Date"=NOW()
        WHERE "TicketID"=$1
          AND "AssignedTo"=$2
          AND "Status"='InProgress'
      `;
      values = [ticketId, req.user.email];

    } else {
      return res.status(400).json({ msg: "Invalid status transition" });
    }

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ msg: "Invalid workflow step" });
    }

    res.json({ msg: `Status updated to ${status} ✅` });

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Failed to update status" });
  }
});


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

    // ✅ Send WhatsApp to new engineer
    try {
      const engRes = await pool.query(
        `SELECT "Email", "Phone" FROM public."Users" WHERE "Email" = $1`,
        [assignedTo]
      );
      const engineer = engRes.rows[0];
      const ticket = ticketRes.rows[0];

      if (engineer?.Phone && ticket) {
        const engineerName = engineer.Email.split('@')[0];
        const assignedTimeIST = new Date().toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour12: true,
          year: 'numeric', month: 'short', day: '2-digit',
          hour: '2-digit', minute: '2-digit'
        });

        notifyEngineerTicketCreated(
          engineer.Phone,
          engineerName,
          {
            ticketNo: ticket.TicketNo,
            customerName: ticket.CustomerName,
            siteName: ticket.SiteName,
            issueDetails: ticket.IssueDetails,
            priority: ticket.priority,
            createdTime: assignedTimeIST
          }
        ).catch(err => console.error('WhatsApp reassign notify error:', err.message));

        console.log(`✅ Reassignment WhatsApp sent to ${assignedTo}`);
      }
    } catch (waErr) {
      console.error('WhatsApp reassign error:', waErr.message);
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

    // 2️⃣ SEND WHATSAPP TO DISPATCHER 🔥
    try {
      const dispatcherRes = await pool.query(
        `SELECT "Phone" FROM public."Users" WHERE "Role" = 'Dispatcher' LIMIT 1`
      );

      const dispatcher = dispatcherRes.rows[0];

      if (dispatcher?.Phone) {

        const msg =
`🔔 *Manager Alert — SAI Automation*

👔 From: ${req.user.email.split('@')[0]}
🏢 Customer: ${customerName}
📍 Site: ${siteName}
⚠️ Priority: ${priority}

📋 Issue:
${issueDetails}

👉 Please check Dispatcher Dashboard immediately.
`;

        await sendWhatsApp(dispatcher.Phone, msg);

        console.log("✅ WhatsApp sent to Dispatcher");
      } else {
        console.log("⚠️ Dispatcher phone not found");
      }

    } catch (waErr) {
      console.error("❌ WhatsApp error:", waErr.message);
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
      `SELECT * FROM "ManagerNotifications"
       ORDER BY "CreatedAt" DESC`
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Failed to fetch notifications" });
  }
});

// ✅ Dispatcher Mark Notification as Done
router.put("/manager-notify/:id/done", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "Dispatcher") {
      return res.status(403).json({ msg: "Only Dispatcher allowed" });
    }

    const result = await pool.query(
      `UPDATE "ManagerNotifications" SET "Status" = 'done' WHERE "NotificationID" = $1`,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ msg: "Notification not found" });
    }

    res.json({ msg: "✅ Marked as done" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Failed to update" });
  }
});
module.exports = router;
