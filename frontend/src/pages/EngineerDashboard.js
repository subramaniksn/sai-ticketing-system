import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";

// ✅ IST DATE FORMATTER - Matches SQL exactly (2026-02-17 17:38:07)
const formatIstDate = (dateString) => {
  if (typeof dateString === 'string' && !dateString.includes('T')) {
    return dateString.substring(0, 19); 
  }
  const date = new Date(dateString);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

// ✅ Status Colors & Icons (DEFINED BEFORE COMPONENT)
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

// ✅ COMPLETE PRODUCTION STYLES (DEFINED FIRST - NO CIRCULAR REFERENCES)
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
    fontSize: "14px",
    transition: "all 0.2s"
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
    padding: "32px",
    '@media (max-width: 1000px)': {
      gridTemplateColumns: "1fr",
      gap: "24px"
    }
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
  timestamp: { 
    fontSize: "14px", 
    color: "#6b7280", 
    padding: "12px 0",
    borderLeft: "4px solid #d1d5db",
    paddingLeft: "20px",
    margin: "8px 0",
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
    transition: "all 0.2s",
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
  },
  actionButtons: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
    marginBottom: "20px"
  },
  actionButton: {
    padding: "16px 20px",
    color: "white",
    border: "none",
    borderRadius: "12px",
    fontWeight: "600",
    fontSize: "15px",
    cursor: "pointer",
    transition: "all 0.3s ease",
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
    transition: "all 0.3s ease",
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
  const [viewMode, setViewMode] = useState("table"); // default table
  const [selectedTicket, setSelectedTicket] = useState(null);

  // 🔄 Load My Tickets (ALL statuses: Open, InProgress, Pending, Resolved)
  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem("token");
      if (!token) throw new Error("No token found");

      const res = await API.get("/tickets/mytickets", {
        headers: { Authorization: `Bearer ${token}` }
      });

      setTickets(res.data || []);
    } catch (err) {
      console.error("Load tickets error:", err);

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

  // 🔄 Update Status: Open→InProgress → InProgress→Pending → Pending→Resolved
  const updateStatus = useCallback(async (ticketId, status) => {
    try {
      setProcessing(prev => ({ ...prev, [ticketId]: true }));

      const token = localStorage.getItem("token");

      await API.put(`/tickets/update-status/${ticketId}`, { status }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      loadTickets(); // Reload to show timestamps
    } catch (err) {
      console.error("Status update error:", err);
      alert("Error: " + (err.response?.data?.msg || "Failed to update status"));
    } finally {
      setProcessing(prev => ({ ...prev, [ticketId]: false }));
    }
  }, [loadTickets]);

  // ✅ Resolve Ticket (only from Pending + remark required)
  const resolveTicket = useCallback(async (ticketId) => {
    const ticketRemark = remarks[ticketId];
    if (!ticketRemark?.trim()) {
      alert("Please add a remark before resolving");
      return;
    }

    try {
      setProcessing(prev => ({ ...prev, [ticketId]: true }));

      const token = localStorage.getItem("token");

      await API.put(`/tickets/resolve/${ticketId}`, {
        remark: ticketRemark
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setRemarks(prev => ({ ...prev, [ticketId]: "" }));
      loadTickets();
    } catch (err) {
      console.error("Resolve error:", err);
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
    window.location.href = "/"; // Direct redirect to login
  };

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  if (loading) {
    return (
      <div style={styles.loadingContainer || { padding: "20px", textAlign: "center" }}>
        <h2 style={{ color: "#6b7280" }}>Loading Engineer Dashboard...</h2>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {/* ✅ SAI LOGO */}
          <img src="/logo.png" alt="SAI Automation" style={styles.logo} />
          <h2 style={styles.title}>🔧 SAI Engineer Dashboard</h2>
        </div>
        <button 
          onClick={() => setShowLogoutConfirm(true)}
          style={styles.logoutButton}
        >
          🚪 Logout
        </button>
      </div>

      {showLogoutConfirm && (
        <div style={styles.logoutModal}>
          <div style={styles.logoutModalContent}>
            <h3 style={{ margin: "0 0 16px 0", color: "#1e293b" }}>🔒 Confirm Logout</h3>
            <p style={{ margin: "0 0 24px 0", color: "#64748b" }}>Are you sure you want to logout?</p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button 
                onClick={() => setShowLogoutConfirm(false)}
                style={styles.cancelButton}
              >
                Cancel
              </button>
              <button 
                onClick={handleLogout}
                style={styles.confirmLogoutButton}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div style={styles.errorCard}>
          {error}
          <button onClick={loadTickets} style={styles.retryButton}>
            🔄 Retry
          </button>
        </div>
      )}

      {tickets.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: "64px", marginBottom: "24px", opacity: 0.5 }}>📭</div>
          <h3>No assigned tickets found</h3>
        </div>
      ) : viewMode === "table" ? (  

        // ✅ TABLE VIEW
        <div style={{
          background: "white",
          borderRadius: "12px",
          overflow: "auto",
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)"
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#1976d2", color: "white" }}>
                <th style={{ padding: "10px" }}>Ticket</th>
                <th style={{ padding: "10px" }}>Customer</th>
                <th style={{ padding: "10px" }}>Site</th>
                <th style={{ padding: "10px" }}>Priority</th>
                <th style={{ padding: "10px" }}>Status</th>
                <th style={{ padding: "10px" }}>Action</th>
              </tr>
            </thead>

            <tbody>
              {tickets.map((t) => (
                <tr key={t.TicketID} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "10px" }}>{t.TicketNo}</td>
                  <td style={{ padding: "10px" }}>{t.CustomerName}</td>
                  <td style={{ padding: "10px" }}>{t.SiteName}</td>

                  <td style={{ padding: "10px" }}>
                    <span style={{
                      background: t.priority === "High" ? "#ef4444" :
                                t.priority === "Medium" ? "#f59e0b" : "#10b981",
                      color: "white",
                      padding: "4px 10px",
                      borderRadius: "20px"
                    }}>
                      {t.priority}
                    </span>
                  </td>

                  <td style={{ padding: "10px" }}>
                    {getStatusIcon(t.Status)} {t.Status}
                  </td>

                  <td style={{ padding: "10px" }}>
                    <button
                      onClick={() => {
                        setSelectedTicket(t);
                        setViewMode("card");
                      }}
                      style={{
                        padding: "6px 12px",
                        background: "#1976d2",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer"
                      }}
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

        // ✅ SINGLE CARD VIEW
        <div>
          
          {/* 🔙 BACK BUTTON */}
          <button
            onClick={() => {
              setViewMode("table");
              setSelectedTicket(null);
            }}
            style={{
              marginBottom: "20px",
              padding: "10px 16px",
              background: "#6b7280",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer"
            }}
          >
            ⬅ Back to Table
          </button>

          {/* ✅ SHOW ONLY SELECTED TICKET */}
          <div style={styles.ticketGrid}>
            {[selectedTicket].map((t) => (
              <div key={t.TicketID} style={styles.ticketCard}>
                <div style={styles.ticketLayout}>

                  {/* LEFT SIDE */}
                  <div style={styles.detailsSection}>
                    <h4 style={styles.ticketNumber}>🎫 {t.TicketNo}</h4>

                    <div style={styles.infoRow}><strong>Customer:</strong> {t.CustomerName}</div>
                    <div style={styles.infoRow}><strong>Site:</strong> {t.SiteName}</div>

                    <div style={styles.infoRow}>
                      <strong>Priority:</strong>
                      <span style={{
                        background: t.priority === "High" ? "#ef4444" :
                                  t.priority === "Medium" ? "#f59e0b" : "#10b981",
                        color: "white",
                        padding: "4px 10px",
                        borderRadius: "20px"
                      }}>
                        {t.priority}
                      </span>
                    </div>

                    <div style={styles.infoRow}>
                      <strong>Issue:</strong> {t.IssueDetails}
                    </div>

                    <div style={{
                      ...styles.statusBadge,
                      color: getStatusColor(t.Status),
                      backgroundColor: getStatusColor(t.Status) + "20"
                    }}>
                      {getStatusIcon(t.Status)} {t.Status}
                    </div>

                    {t.InProgress_Date && <div style={styles.timestamp}>🚀 {formatIstDate(t.InProgress_Date)}</div>}
                    {t.Pending_Date && <div style={styles.timestamp}>⏳ {formatIstDate(t.Pending_Date)}</div>}
                    {t.Resolved_Date && <div style={styles.timestamp}>✅ {formatIstDate(t.Resolved_Date)}</div>}
                  </div>

                  {/* RIGHT SIDE ACTIONS */}
                  <div style={styles.actionsSection}>
                    <textarea
                      placeholder="Add remark..."
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
                      style={{ ...styles.resolveButton, background: "#10b981" }}
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
