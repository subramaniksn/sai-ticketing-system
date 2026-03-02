import { useEffect, useState } from "react";
import axios from "axios";

export default function TicketList() {
  const [tickets, setTickets] = useState([]);

  const loadTickets = async () => {
    const res = await axios.get("http://localhost:5000/api/tickets/all");
    setTickets(res.data);
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const resolveTicket = async (id) => {
    const remark = prompt("Enter Resolution Remark:");

    await axios.put(`http://localhost:5000/api/tickets/resolve/${id}`, {
      remark,
    });

    alert("Ticket Resolved!");
    loadTickets();
  };

  return (
    <div>
      <h2>All Tickets</h2>

      <table border="1">
        <thead>
          <tr>
            <th>ID</th>
            <th>Customer</th>
            <th>Site</th>
            <th>Status</th>
            <th>Escalated</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {tickets.map((t) => (
            <tr key={t.TicketID}>
              <td>{t.TicketID}</td>
              <td>{t.CustomerName}</td>
              <td>{t.SiteName}</td>
              <td>{t.Status}</td>
              <td>{t.Escalated ? "YES" : "NO"}</td>

              <td>
                {t.Status !== "Resolved" && (
                  <button onClick={() => resolveTicket(t.TicketID)}>
                    Resolve
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
