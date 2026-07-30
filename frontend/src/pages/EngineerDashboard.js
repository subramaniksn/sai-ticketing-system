import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";
import AmcAccessDetails from "../components/AmcAccessDetails";

// ✅ IST DATE FORMATTER — matches DispatcherDashboard exactly
const formatIstDate = (dateString) => {
  if (!dateString) return 'N/A';
  // Handle SQL datetime "2026-05-18 03:23:00" (no T) → append T and Z to treat as UTC
  const normalized = typeof dateString === 'string' && !dateString.includes('T')
    ? dateString.replace(' ', 'T') + 'Z'
    : dateString;
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
};

// ✅ Status Colors & Icons
const getStatusColor = (status) => {
  switch (status) {
    case "Open": return "#e74c3c";
    case "InProgress": return "#f39c12";
    case "Pending": return "#3498db";
    case "Resolved": return "#27ae60";
    default: return "#95a5a6";
  }
};

const getStatusIcon = (status) => {
  switch (status) {
    case "Open": return "🔴";
    case "InProgress": return "🟡";
    case "Pending": return "🔵";
    case "Resolved": return "🟢";
    default: return "📌";
  }
};

const styles = {
  container: {
    padding: "30px",
    background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
    minHeight: "100vh",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
  },
  title: {
    margin: "0 0 30px 0",
    fontWeight: "700",
    color: "#1a1a1a",
    fontSize: "32px",
    textAlign: "center"
  },
  errorCard: {
    background: "#fee2e2",
    color: "#dc2626",
    padding: "24px",
    borderRadius: "16px",
    marginBottom: "30px",
    borderLeft: "5px solid #ef4444",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
  },
  retryButton: {
    marginLeft: "15px",
    padding: "12px 24px",
    background: "#3b82f6",
    color: "white",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "14px"
  },
  emptyState: {
    textAlign: "center",
    padding: "80px 40px",
    color: "#6b7280",
    background: "white",
    borderRadius: "20px",
    border: "3px dashed #d1d5db",
    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
    maxWidth: "600px",
    margin: "40px auto"
  },
  ticketGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(850px, 1fr))",
    gap: "28px",
    maxWidth: "1400px",
    margin: "0 auto"
  },
  ticketCard: {
    background: "white",
    borderRadius: "20px",
    boxShadow: "0 12px 40px rgba(0,0,0,0.1)",
    overflow: "hidden",
    borderLeft: "6px solid #1976d2"
  },
  ticketLayout: {
    display: "grid",
    gridTemplateColumns: "1fr 400px",
    gap: "32px",
    padding: "32px"
  },
  detailsSection: {
    display: "flex",
    flexDirection: "column",
    gap: "16px"
  },
  actionsSection: {
    display: "flex",
    flexDirection: "column",
    gap: "16px"
  },
  ticketNumber: {
    margin: 0,
    fontSize: "28px",
    color: "#1976d2",
    fontWeight: "800"
  },
  infoRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    fontSize: "16px",
    color: "#374151",
    padding: "8px 0"
  },
  statusBadge: {
    padding: "16px 24px",
    borderRadius: "30px",
    margin: "20px 0",
    fontWeight: "700",
    fontSize: "16px",
    display: "inline-flex",
    alignItems: "center",
    gap: "12px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
  },
  // ✅ FIXED timestamp style — shows IST label clearly
  timestamp: {
    fontSize: "14px",
    color: "#6c757d",
    padding: "10px 16px",
    borderLeft: "4px solid #d1d5db",
    margin: "6px 0",
    background: "#f9fafb",
    borderRadius: "8px"
  },
  remarkInput: {
    width: "100%",
    padding: "16px",
    borderRadius: "12px",
    border: "2px solid #e5e7eb",
    fontSize: "15px",
    resize: "vertical",
    fontFamily: "inherit",
    minHeight: "100px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
  },
  actionButton: {
    padding: "16px 20px",
    color: "white",
    border: "none",
    borderRadius: "12px",
    fontWeight: "600",
    fontSize: "15px",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
  },
  resolveButton: {
    width: "100%",
    padding: "20px",
    color: "white",
    border: "none",
    borderRadius: "14px",
    fontWeight: "700",
    fontSize: "16px",
    cursor: "pointer",
    boxShadow: "0 6px 20px rgba(0,0,0,0.2)"
  },
  logoutButton: {
    padding: "10px 20px",
    background: "#dc3545",
    color: "white",
    border: "none",
    borderRadius: "10px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    whiteSpace: "nowrap",
    boxShadow: "0 2px 8px rgba(220,53,69,0.3)"
  },
  logoutModal: {
    position: "fixed",
    top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000
  },
  logoutModalContent: {
    background: "white",
    padding: "32px",
    borderRadius: "16px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
    maxWidth: "400px", width: "90%",
    textAlign: "center"
  },
  cancelButton: {
    padding: "12px 24px",
    background: "#6c757d",
    color: "white",
    border: "none",
    borderRadius: "10px",
    fontWeight: "600",
    cursor: "pointer"
  },
  confirmLogoutButton: {
    padding: "12px 24px",
    background: "#dc3545",
    color: "white",
    border: "none",
    borderRadius: "10px",
    fontWeight: "600",
    cursor: "pointer"
  },
  logo: {
    width: "70px",
    height: "60px",
    objectFit: "contain"
  }
};

export default function EngineerDashboard() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [remarks, setRemarks] = useState({});
  const [processing, setProcessing] = useState({});
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [viewMode, setViewMode] = useState("table");
  const [selectedTicket, setSelectedTicket] = useState(null);

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No token found");
      const res = await API.get("/tickets/mytickets", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const loadedTickets = res.data || [];
      setTickets(loadedTickets);
      return loadedTickets;
    } catch (err) {
      if (err.response?.status === 401 || err.message.includes("token")) {
        localStorage.clear();
        navigate("/", { replace: true });
        return;
      }
      setError("Failed to load your tickets. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const updateStatus = useCallback(async (ticketId, status) => {
    try {
      setProcessing(prev => ({ ...prev, [ticketId]: true }));
      const token = localStorage.getItem("token");
      const res = await API.put(`/tickets/update-status/${ticketId}`, { status }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const updatedTicket = res.data?.ticket;

      if (updatedTicket) {
        setTickets(prev => prev.map(ticket =>
          ticket.TicketID === updatedTicket.TicketID
            ? { ...ticket, ...updatedTicket }
            : ticket
        ));
        setSelectedTicket(prev =>
          prev?.TicketID === updatedTicket.TicketID
            ? { ...prev, ...updatedTicket }
            : prev
        );
      }

      await loadTickets();
    } catch (err) {
      alert("Error: " + (err.response?.data?.msg || "Failed to update status"));
    } finally {
      setProcessing(prev => ({ ...prev, [ticketId]: false }));
    }
  }, [loadTickets]);

  const resolveTicket = useCallback(async (ticketId) => {
    const ticketRemark = remarks[ticketId];
    if (!ticketRemark?.trim()) {
      alert("Please add a remark before resolving");
      return;
    }
    try {
      setProcessing(prev => ({ ...prev, [ticketId]: true }));
      const token = localStorage.getItem("token");
      await API.put(`/tickets/resolve/${ticketId}`, { remark: ticketRemark }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRemarks(prev => ({ ...prev, [ticketId]: "" }));
      loadTickets();
    } catch (err) {
      alert("Error: " + (err.response?.data?.msg || "Failed to resolve ticket"));
    } finally {
      setProcessing(prev => ({ ...prev, [ticketId]: false }));
    }
  }, [remarks, loadTickets]);

  const updateRemark = (ticketId, value) => {
    setRemarks(prev => ({ ...prev, [ticketId]: value }));
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/";
  };

  useEffect(() => { loadTickets(); }, [loadTickets]);

  if (loading) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h2 style={{ color: "#6b7280" }}>Loading Engineer Dashboard...</h2>
      </div>
    );
  }

  return (
    <div style={styles.container}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <img src="/logo.png" alt="SAI Automation" style={styles.logo} />
          <h2 style={styles.title}>🔧 SAI Engineer Dashboard</h2>
        </div>
        <button onClick={() => setShowLogoutConfirm(true)} style={styles.logoutButton}>
          🚪 Logout
        </button>
      </div>

      {/* Logout Confirm */}
      {showLogoutConfirm && (
        <div style={styles.logoutModal}>
          <div style={styles.logoutModalContent}>
            <h3 style={{ margin: "0 0 16px 0", color: "#1e293b" }}>🔒 Confirm Logout</h3>
            <p style={{ margin: "0 0 24px 0", color: "#64748b" }}>Are you sure you want to logout?</p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowLogoutConfirm(false)} style={styles.cancelButton}>Cancel</button>
              <button onClick={handleLogout} style={styles.confirmLogoutButton}>Logout</button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div style={styles.errorCard}>
          {error}
          <button onClick={loadTickets} style={styles.retryButton}>🔄 Retry</button>
        </div>
      )}

      {tickets.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: "64px", marginBottom: "24px", opacity: 0.5 }}>📭</div>
          <h3>No assigned tickets found</h3>
        </div>

      ) : viewMode === "table" ? (

        // ── TABLE VIEW ──────────────────────────────────────────────────────
        <div style={{ background: "white", borderRadius: "12px", overflow: "auto", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#1976d2", color: "white" }}>
                {["Ticket", "Customer", "Site", "Priority", "Status", "Created (IST)", "Action"].map(h => (
                  <th key={h} style={{ padding: "12px", textAlign: "left", fontSize: "14px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tickets.map((t, idx) => (
                <tr key={t.TicketID} style={{ borderBottom: "1px solid #eee", background: idx % 2 === 0 ? "#fff" : "#f9fafb" }}>
                  <td style={{ padding: "10px", fontWeight: "700", color: "#1976d2" }}>{t.TicketNo}</td>
                  <td style={{ padding: "10px" }}>{t.CustomerName}</td>
                  <td style={{ padding: "10px" }}>{t.SiteName}</td>
                  <td style={{ padding: "10px" }}>
                    <span style={{
                      background: t.priority === "High" ? "#ef4444" : t.priority === "Medium" ? "#f59e0b" : "#10b981",
                      color: "white", padding: "4px 10px", borderRadius: "20px", fontSize: "13px"
                    }}>
                      {t.priority}
                    </span>
                  </td>
                  <td style={{ padding: "10px" }}>
                    <span style={{
                      padding: "5px 10px", borderRadius: "20px",
                      background: getStatusColor(t.Status) + "20",
                      color: getStatusColor(t.Status), fontWeight: "600", fontSize: "13px"
                    }}>
                      {getStatusIcon(t.Status)} {t.Status}
                    </span>
                  </td>
                  {/* ✅ IST time in table */}
                  <td style={{ padding: "10px", fontSize: "13px", color: "#6b7280" }}>
                    {formatIstDate(t.CreatedTime)}
                  </td>
                  <td style={{ padding: "10px" }}>
                    <button
                      onClick={() => { setSelectedTicket(t); setViewMode("card"); }}
                      style={{ padding: "6px 14px", background: "#1976d2", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "700", fontSize: "13px" }}
                    >
                      👁 View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      ) : (

        // ── CARD / DETAIL VIEW ──────────────────────────────────────────────
        <div>
          <button
            onClick={() => { setViewMode("table"); setSelectedTicket(null); }}
            style={{ marginBottom: "20px", padding: "10px 18px", background: "#6b7280", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}
          >
            ⬅ Back to Table
          </button>

          <div style={styles.ticketGrid}>
            {[selectedTicket].map((t) => (
              <div key={t.TicketID} style={styles.ticketCard}>
                <div style={styles.ticketLayout}>

                  {/* LEFT — Details */}
                  <div style={styles.detailsSection}>
                    <h4 style={styles.ticketNumber}>🎫 {t.TicketNo}</h4>

                    <div style={styles.infoRow}><strong>Customer:</strong>&nbsp;{t.CustomerName}</div>
                    <div style={styles.infoRow}><strong>Site:</strong>&nbsp;{t.SiteName}</div>

                    <div style={styles.infoRow}>
                      <strong>Priority:</strong>&nbsp;
                      <span style={{
                        background: t.priority === "High" ? "#ef4444" : t.priority === "Medium" ? "#f59e0b" : "#10b981",
                        color: "white", padding: "4px 12px", borderRadius: "20px", fontSize: "13px"
                      }}>
                        {t.priority}
                      </span>
                    </div>

                    <div style={styles.infoRow}><strong>Issue:</strong>&nbsp;{t.IssueDetails}</div>

                    <AmcAccessDetails ticket={t} />

                    <div style={{
                      ...styles.statusBadge,
                      color: getStatusColor(t.Status),
                      backgroundColor: getStatusColor(t.Status) + "20"
                    }}>
                      {getStatusIcon(t.Status)} {t.Status}
                    </div>

                    {/* ✅ ALL TIMESTAMPS IN IST */}
                    {t.CreatedTime && (
                      <div style={styles.timestamp}>🕒 Created (IST): {formatIstDate(t.CreatedTime)}</div>
                    )}
                    {t.InProgress_Date && (
                      <div style={styles.timestamp}>🚀 Started (IST): {formatIstDate(t.InProgress_Date)}</div>
                    )}
                    {t.Pending_Date && (
                      <div style={styles.timestamp}>⏳ Pending (IST): {formatIstDate(t.Pending_Date)}</div>
                    )}
                    {t.Resolved_Date && (
                      <div style={styles.timestamp}>✅ Resolved (IST): {formatIstDate(t.Resolved_Date)}</div>
                    )}

                    {t.Remark && (
                      <div style={{ marginTop: "12px", padding: "12px 16px", background: "#f0fdf4", borderRadius: "8px", borderLeft: "4px solid #10b981" }}>
                        <div style={{ fontSize: "12px", fontWeight: "700", color: "#6b7280", marginBottom: "4px" }}>REMARK</div>
                        <div style={{ fontSize: "14px", color: "#1e293b" }}>{t.Remark}</div>
                      </div>
                    )}
                  </div>

                  {/* RIGHT — Actions */}
                  <div style={styles.actionsSection}>
                    <textarea
                      placeholder="Add remark before resolving..."
                      value={remarks[t.TicketID] || ""}
                      onChange={(e) => updateRemark(t.TicketID, e.target.value)}
                      style={styles.remarkInput}
                    />

                    <button
                      onClick={() => updateStatus(t.TicketID, "InProgress")}
                      disabled={t.Status !== "Open" || processing[t.TicketID]}
                      style={{
                        ...styles.actionButton,
                        background: t.Status === "Open" ? "#f59e0b" : "#9ca3af",
                        opacity: t.Status === "Open" && !processing[t.TicketID] ? 1 : 0.6
                      }}
                    >
                      {processing[t.TicketID] ? "⏳ Processing..." : "⚙️ Start Work"}
                    </button>

                    <button
                      onClick={() => updateStatus(t.TicketID, "Pending")}
                      disabled={t.Status !== "InProgress" || processing[t.TicketID]}
                      style={{
                        ...styles.actionButton,
                        background: t.Status === "InProgress" ? "#3b82f6" : "#9ca3af",
                        opacity: t.Status === "InProgress" && !processing[t.TicketID] ? 1 : 0.6
                      }}
                    >
                      {processing[t.TicketID] ? "⏳ Processing..." : "📞 Wait Customer"}
                    </button>

                    <button
                      onClick={() => resolveTicket(t.TicketID)}
                      disabled={
                        !remarks[t.TicketID]?.trim() ||
                        (t.Status !== "InProgress" && t.Status !== "Pending") ||
                        processing[t.TicketID]
                      }
                      style={{
                        ...styles.resolveButton,
                        background: "#10b981",
                        opacity: (!remarks[t.TicketID]?.trim() || (t.Status !== "InProgress" && t.Status !== "Pending")) ? 0.6 : 1
                      }}
                    >
                      ✅ Resolve
                    </button>
                  </div>

                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
