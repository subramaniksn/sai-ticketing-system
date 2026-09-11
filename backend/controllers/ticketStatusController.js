function createTicketStatusController({ pool, sendManagerWhatsApp }) {
  async function updateTicketStatus(req, res) {
    if (req.user?.role !== "Engineer") {
      return res.status(403).json({ msg: "Only Engineers allowed" });
    }

    const ticketId = Number(req.params.id);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return res.status(400).json({ msg: "Invalid ticket ID" });
    }

    const transitions = {
      InProgress: { from: "Open", dateColumn: "InProgress_Date" },
      Pending: { from: "InProgress", dateColumn: "Pending_Date" }
    };
    const transition = transitions[req.body?.status];

    if (!transition) {
      return res.status(400).json({ msg: "Invalid status transition" });
    }

    try {
      const result = await pool.query(
        `UPDATE "Tickets"
        SET "Status" = $1,
            "${transition.dateColumn}" = NOW()
        WHERE "TicketID" = $2
          AND "AssignedTo" = $3
          AND "Status" = $4
        RETURNING "TicketID", "Status", "SourceNotificationId",
          "InProgress_Date"::timestamptz AT TIME ZONE 'Asia/Kolkata' AS "InProgress_Date",
          "Pending_Date"::timestamptz AT TIME ZONE 'Asia/Kolkata' AS "Pending_Date"`,
        [req.body.status, ticketId, req.user.email, transition.from]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ msg: "Invalid workflow step" });
      }

      const ticket = result.rows[0];

      if (req.body.status === "InProgress" && ticket.SourceNotificationId) {
        try {
          const notif = await pool.query(
            `SELECT "SentBy" FROM "ManagerNotifications" WHERE "NotificationID" = $1`,
            [ticket.SourceNotificationId]
          );
          const managerEmail = notif.rows[0]?.SentBy;
          if (managerEmail) {
            await pool.query(
              `UPDATE "ManagerNotifications" SET "TicketProgress" = $1 WHERE "NotificationID" = $2`,
              ["Assigned & Started", ticket.SourceNotificationId]
            );
            const managerUser = await pool.query(
              `SELECT "Phone" FROM "Users" WHERE "Email" = $1`, [managerEmail]
            );
            await sendManagerWhatsApp(
              managerUser.rows[0]?.Phone,
              `Update: your reported issue is now assigned & in progress with ${req.user.email}.`
            );
          }
        } catch (notifyErr) {
          console.error("Manager progress notify error:", notifyErr.message);
        }
      }

      return res.json({
        msg: `Status updated to ${req.body.status}`,
        ticket
      });
    } catch (err) {
      console.error("Update ticket status error:", err);
      return res.status(500).json({ msg: "Failed to update status" });
    }
  }

  return { updateTicketStatus };
}

module.exports = { createTicketStatusController };