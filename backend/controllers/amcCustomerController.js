const {
  decryptRemotePassword,
  encryptRemotePassword
} = require("../utils/remotePasswordCrypto");
const { validateAmcCustomer } = require("../validation/amcCustomerValidation");

function isDispatcher(req) {
  return req.user?.role === "Dispatcher";
}

function createAmcCustomerController({ pool }) {
  async function createAmcCustomer(req, res) {
    if (!isDispatcher(req)) {
      return res.status(403).json({ msg: "Only Dispatchers allowed" });
    }

    const { data, errors } = validateAmcCustomer(req.body);
    if (errors.length) {
      return res.status(400).json({ msg: errors[0], errors });
    }

    try {
      const duplicate = await pool.query(
        `SELECT "CustomerID"
         FROM "AMCCustomers"
         WHERE lower(btrim("CustomerName")) = lower($1)
           AND lower(btrim("SiteName")) = lower($2)
         LIMIT 1`,
        [data.customerName, data.siteName]
      );

      if (duplicate.rows.length) {
        return res.status(409).json({ msg: "This AMC customer and site already exists" });
      }

      const encryptedPassword = encryptRemotePassword(data.remotePassword);
      const result = await pool.query(
        `INSERT INTO "AMCCustomers"
         ("CustomerName","SiteName","SiteContactName","SiteContactPhone",
          "RemoteTool","RemoteID","RemotePassword")
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING "CustomerID"`,
        [
          data.customerName,
          data.siteName,
          data.siteContactName || null,
          data.siteContactPhone || null,
          data.remoteTool || null,
          data.remoteId || null,
          encryptedPassword
        ]
      );

      return res.status(201).json({
        msg: "AMC Customer added successfully",
        customerId: result.rows[0].CustomerID
      });
    } catch (err) {
      if (err.code === "23505") {
        return res.status(409).json({ msg: "This AMC customer and site already exists" });
      }
      console.error("Insert AMC customer error:", err);
      return res.status(500).json({ msg: "Failed to add AMC customer" });
    }
  }

  async function getAmcCustomers(req, res) {
    if (!isDispatcher(req)) {
      return res.status(403).json({ msg: "Only Dispatchers allowed" });
    }

    try {
      const result = await pool.query(
        `SELECT "CustomerID","CustomerName","SiteName",
                "SiteContactName","SiteContactPhone",
                "RemoteTool","RemoteID",
                ("RemotePassword" IS NOT NULL AND "RemotePassword" <> '') AS "HasRemotePassword"
         FROM "AMCCustomers"
         ORDER BY "CustomerName", "SiteName"`
      );
      res.set("Cache-Control", "no-store");
      return res.json(result.rows);
    } catch (err) {
      console.error("Load AMC customers error:", err);
      return res.status(500).json({ msg: "Failed to load AMC customers" });
    }
  }

  async function getRemotePassword(req, res) {
    if (!isDispatcher(req)) {
      return res.status(403).json({ msg: "Only Dispatchers allowed" });
    }

    const customerId = Number.parseInt(req.params.customerId, 10);
    if (!Number.isInteger(customerId) || customerId <= 0) {
      return res.status(400).json({ msg: "Invalid AMC customer ID" });
    }

    try {
      const result = await pool.query(
        `SELECT "RemotePassword"
         FROM "AMCCustomers"
         WHERE "CustomerID" = $1`,
        [customerId]
      );
      if (!result.rows.length) {
        return res.status(404).json({ msg: "AMC Customer not found" });
      }

      const password = decryptRemotePassword(result.rows[0].RemotePassword);
      res.set("Cache-Control", "no-store");
      return res.json({ password });
    } catch (err) {
      console.error("Reveal AMC remote password error:", err);
      return res.status(500).json({ msg: "Failed to load remote password" });
    }
  }

  async function getTicketRemotePassword(req, res) {
    const ticketId = Number.parseInt(req.params.ticketId, 10);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return res.status(400).json({ msg: "Invalid ticket ID" });
    }

    try {
      const result = await pool.query(
        `SELECT t."AssignedTo", a."RemotePassword"
         FROM "Tickets" t
         LEFT JOIN "AMCCustomers" a
           ON a."CustomerID" = t."AmcCustomerId"
         WHERE t."TicketID" = $1`,
        [ticketId]
      );
      if (!result.rows.length) {
        return res.status(404).json({ msg: "Ticket not found" });
      }

      const ticket = result.rows[0];
      const isAssignedEngineer =
        req.user?.role === "Engineer" && ticket.AssignedTo === req.user.email;
      if (req.user?.role !== "Dispatcher" && !isAssignedEngineer) {
        return res.status(403).json({ msg: "You cannot access this ticket's remote password" });
      }
      if (!ticket.RemotePassword) {
        return res.status(404).json({ msg: "Remote password is not available for this ticket" });
      }

      const password = decryptRemotePassword(ticket.RemotePassword);
      res.set("Cache-Control", "no-store");
      return res.json({ password });
    } catch (err) {
      console.error("Reveal ticket remote password error:", err);
      return res.status(500).json({ msg: "Failed to load remote password" });
    }
  }

  return {
    createAmcCustomer,
    getAmcCustomers,
    getRemotePassword,
    getTicketRemotePassword
  };
}

module.exports = { createAmcCustomerController };
