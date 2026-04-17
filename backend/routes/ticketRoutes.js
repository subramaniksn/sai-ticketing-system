const express = require("express");
const router = express.Router();
const pool = require("../db");
const verifyToken = require("../middleware/authMiddleware");
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');

// ✅ Generate Ticket No Function (PostgreSQL)
async function generateTicketNo() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  
  // 🔥 COUNT ONLY THIS MONTH'S TICKETS by TicketNo pattern
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



// ✅ Dispatcher Create Ticket
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
        "AssignedTo","AmcCustomerId","TicketType","Status")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Open')`,
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
        "TicketID",
        "TicketNo",
        "CustomerName",
        "SiteName",
        "IssueDetails",
        "AssignedTo",
        "Status",
        "Remark",
        "CreatedTime"::timestamptz AT TIME ZONE 'Asia/Kolkata' AS "CreatedTime",
        "ResolvedTime"::timestamptz AT TIME ZONE 'Asia/Kolkata' AS "ResolvedTime",
        "Escalated",
        "InProgress_Date"::timestamptz AT TIME ZONE 'Asia/Kolkata' AS "InProgress_Date",
        "Pending_Date"::timestamptz AT TIME ZONE 'Asia/Kolkata' AS "Pending_Date",
        "Resolved_Date"::timestamptz AT TIME ZONE 'Asia/Kolkata' AS "Resolved_Date",
        "priority",
        "AmcCustomerId",
        "TicketType"
      FROM "Tickets"
      ORDER BY "CreatedTime"::timestamptz AT TIME ZONE 'Asia/Kolkata' DESC;`
    );

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Failed to load tickets" });
  }
});


// ✅ Get AMC Customers
router.get("/amc", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "Dispatcher") {
      return res.status(403).json({ msg: "Only Dispatchers allowed" });
    }

    const result = await pool.query(
      `SELECT "CustomerID","CustomerName","SiteName"
       FROM "AMCCustomers"
       ORDER BY "CustomerName"`
    );

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Failed to load AMC customers" });
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
        "TicketID",
        "TicketNo",
        "CustomerName",
        "SiteName",
        "IssueDetails",
        "AssignedTo",
        "Status",
        "Remark",
        "CreatedTime"::timestamptz AT TIME ZONE 'Asia/Kolkata' AS "CreatedTime",
        "ResolvedTime"::timestamptz AT TIME ZONE 'Asia/Kolkata' AS "ResolvedTime",
        "Escalated",
        "InProgress_Date"::timestamptz AT TIME ZONE 'Asia/Kolkata' AS "InProgress_Date",
        "Pending_Date"::timestamptz AT TIME ZONE 'Asia/Kolkata' AS "Pending_Date",
        "Resolved_Date"::timestamptz AT TIME ZONE 'Asia/Kolkata' AS "Resolved_Date",
        "priority",
        "AmcCustomerId",
        "TicketType"
      FROM "Tickets"
      WHERE "AssignedTo" = $1
      ORDER BY "CreatedTime"::timestamptz AT TIME ZONE 'Asia/Kolkata' DESC`,
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
      "TicketID",
      "TicketNo",
      "CustomerName",
      "SiteName",
      "IssueDetails",
      "AssignedTo",
      "Status",
      "Remark",
      "CreatedTime"::timestamptz AT TIME ZONE 'Asia/Kolkata' AS "CreatedTime",
      "ResolvedTime"::timestamptz AT TIME ZONE 'Asia/Kolkata' AS "ResolvedTime",
      "Escalated",
      "InProgress_Date"::timestamptz AT TIME ZONE 'Asia/Kolkata' AS "InProgress_Date",
      "Pending_Date"::timestamptz AT TIME ZONE 'Asia/Kolkata' AS "Pending_Date",
      "Resolved_Date"::timestamptz AT TIME ZONE 'Asia/Kolkata' AS "Resolved_Date",
      "priority",
      "AmcCustomerId",
      "TicketType"
    FROM "Tickets"
    ORDER BY "CreatedTime"::timestamptz AT TIME ZONE 'Asia/Kolkata' DESC`
    );

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Failed to load tickets" });
  }
});

const { Parser } = require('json2csv');

router.get("/download", verifyToken, async (req, res) => {
  try {
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

        -- ✅ FIXED DATE CONVERSION (NO ERROR)
        COALESCE(("CreatedTime" AT TIME ZONE 'Asia/Kolkata')::text, '') as "CreatedTime",
        COALESCE(("ResolvedTime" AT TIME ZONE 'Asia/Kolkata')::text, '') as "ResolvedTime",

        CASE WHEN "Escalated" THEN 'Yes' ELSE 'No' END as "Escalated",

        COALESCE(("InProgress_Date" AT TIME ZONE 'Asia/Kolkata')::text, '') as "InProgress_Date",
        COALESCE(("Pending_Date" AT TIME ZONE 'Asia/Kolkata')::text, '') as "Pending_Date",
        COALESCE(("Resolved_Date" AT TIME ZONE 'Asia/Kolkata')::text, '') as "Resolved_Date",

        "priority",
        COALESCE("AmcCustomerId"::text, '') as "AmcCustomerId",
        "TicketType"

      FROM "Tickets"
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    // ✅ DATE FILTER (FIXED)
    if (req.query.startDate && req.query.endDate) {
      query += ` AND "CreatedTime" BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      params.push(req.query.startDate + " 00:00:00");
      params.push(req.query.endDate + " 23:59:59");
      paramIndex += 2;
    }

    // ✅ CUSTOMER FILTER
    if (req.query.customer && req.query.customer !== '') {
      query += ` AND "CustomerName" ILIKE $${paramIndex}`;
      params.push(`%${req.query.customer}%`);
      paramIndex++;
    }

    query += ` ORDER BY "CreatedTime" DESC`;

    const result = await pool.query(query, params);

    // ✅ HANDLE EMPTY DATA
    if (!result.rows || result.rows.length === 0) {
      return res.status(200).send("No data available");
    }

    // ✅ CONVERT JSON → CSV
    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(result.rows);

    // ✅ SEND CSV FILE
    res.header('Content-Type', 'text/csv');
    res.attachment(`SAI_Tickets_${req.query.startDate || 'all'}_to_${req.query.endDate || 'all'}.csv`);

    return res.send(csv);

  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ msg: "Failed to download tickets" });
  }
});

router.put("/reassign/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "Dispatcher") {
      return res.status(403).json({ msg: "Only Dispatcher can reassign" });
    }

    const { assignedTo } = req.body;

    await pool.query(
      `UPDATE "Tickets"
       SET "AssignedTo" = $1
       WHERE "TicketID" = $2`,
      [assignedTo, req.params.id]
    );

    res.json({ msg: "✅ Ticket reassigned successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error updating ticket" });
  }
});

// ✅ GET Engineers List
router.get("/users/engineers", verifyToken, async (req, res) => {
  try {
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

module.exports = router;
