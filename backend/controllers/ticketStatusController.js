function createTicketStatusController({ pool }) {
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
         RETURNING "TicketID", "Status", "InProgress_Date", "Pending_Date"`,
        [req.body.status, ticketId, req.user.email, transition.from]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ msg: "Invalid workflow step" });
      }

      return res.json({
        msg: `Status updated to ${req.body.status}`,
        ticket: result.rows[0]
      });
    } catch (err) {
      console.error("Update ticket status error:", err);
      return res.status(500).json({ msg: "Failed to update status" });
    }
  }

  return { updateTicketStatus };
}

module.exports = { createTicketStatusController };
