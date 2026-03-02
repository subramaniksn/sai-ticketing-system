import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";

const parseSqlDate = (dateString) => {
  if (!dateString || typeof dateString !== 'string') return null;
  try {
    const cleanDate = dateString.split('.')[0].replace(' ', 'T');
    const date = new Date(cleanDate);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
};

const formatIstDate = (dateString) => {
  const date = parseSqlDate(dateString);
  if (!date) return 'N/A';
  return date.toLocaleString('en-IN', { 
    timeZone: 'Asia/Kolkata',
    month: 'short', day: 'numeric', 
    hour: '2-digit', minute: '2-digit'
  });
};

const getStatusColor = (status) => ({
  "Open": "#e74c3c", "InProgress": "#f39c12", "Pending": "#3498db", "Resolved": "#27ae60"
}[status] || "#95a5a6");

const getStatusIcon = (status) => ({
  "Open": "🔴", "InProgress": "🟡", "Pending": "🔵", "Resolved": "🟢"
}[status] || "📌");

const calculateDuration = (start, end = null) => {
  const s = parseSqlDate(start);
  if (!s) return "0h 0m";
  const e = end ? parseSqlDate(end) : new Date();
  if (!e) return "0h 0m";
  const diff = Math.max(0, e - s);
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
};

const styles = {
  container: { 
    minHeight: "100vh",
    background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
    fontFamily: "'Segoe UI', Tahoma, sans-serif",
    padding: "15px",
    maxWidth: "1200px",
    margin: "0 auto"
  },
  header: {
    background: "white",
    padding: "20px 25px",
    borderRadius: "12px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
    marginBottom: "25px"
  },
  title: {
    margin: "0 0 10px 0",
    fontSize: "24px",
    fontWeight: "800",
    color: "#1a1a1a",
    textAlign: "center"
  },
  headerStats: {
    fontSize: "14px",
    color: "#666",
    textAlign: "center"
  },
  downloadPanel: {
    background: "white",
    padding: "25px",
    borderRadius: "16px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
    marginBottom: "25px",
    border: "2px solid #e2e8f0"
  },
  downloadTitle: {
    fontSize: "20px",
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: "20px",
    display: "flex",
    alignItems: "center",
    gap: "12px"
  },
  filterRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr auto",
    gap: "20px",
    marginBottom: "25px",
    alignItems: "end"
  },
  filterGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px"
  },
  filterLabel: {
    fontSize: "13px",
    fontWeight: "700",
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: "0.5px"
  },
  dateInput: {
    padding: "12px 16px",
    border: "2px solid #e2e8f0",
    borderRadius: "10px",
    fontSize: "14px",
    background: "white",
    transition: "all 0.2s"
  },
  customerSelect: {
    padding: "12px 12px 12px 16px",
    border: "2px solid #e2e8f0",
    borderRadius: "10px",
    fontSize: "14px",
    background: "white",
    transition: "all 0.2s"
  },
  downloadBtn: {
    padding: "16px 32px",
    background: "linear-gradient(135deg, #10b981, #059669)",
    color: "white",
    border: "none",
    borderRadius: "12px",
    fontSize: "16px",
    fontWeight: "800",
    cursor: "pointer",
    boxShadow: "0 8px 25px rgba(16, 185, 129, 0.3)",
    transition: "all 0.2s",
    whiteSpace: "nowrap",
    display: "flex",
    alignItems: "center",
    gap: "10px"
  },
  downloadBtnDisabled: {
    background: "#9ca3af",
    cursor: "not-allowed",
    boxShadow: "none"
  },
  statusGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
    gap: "15px",
    marginBottom: "25px"
  },
  statusCard: {
    padding: "15px 10px",
    borderRadius: "12px",
    textAlign: "center",
    border: "2px solid transparent",
    background: "white",
    boxShadow: "0 4px 12px rgba(0,0,0,0.06)"
  },
  statusIcon: { fontSize: "22px", marginBottom: "5px" },
  statusTitle: { 
    fontSize: "10px", 
    fontWeight: "700", 
    marginBottom: "5px", 
    textTransform: "uppercase", 
    letterSpacing: "0.5px" 
  },
  statusCount: { fontSize: "24px", fontWeight: "900", lineHeight: 1 },
  ticketGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(750px, 1fr))",
    gap: "20px"
  },
  ticketCard: {
    background: "white",
    borderRadius: "16px",
    padding: "20px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
    borderLeft: "5px solid #e74c3c"
  },
  ticketHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "15px",
    gap: "10px"
  },
  ticketNumber: {
    fontSize: "20px",
    fontWeight: "800",
    color: "#e74c3c",
    margin: 0
  },
  priorityBadge: {
    padding: "6px 16px",
    borderRadius: "20px",
    color: "white",
    fontSize: "12px",
    fontWeight: "700"
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "15px",
    marginBottom: "15px"
  },
  infoItem: {
    display: "flex",
    flexDirection: "column",
    gap: "4px"
  },
  infoLabel: {
    fontSize: "11px",
    color: "#6b7280",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.3px"
  },
  infoValue: {
    fontSize: "13px",
    fontWeight: "700",
    color: "#1f2937",
    wordBreak: "break-word"
  },
  statusDisplay: {
    padding: "10px 16px",
    borderRadius: "25px",
    marginBottom: "15px",
    fontWeight: "700",
    fontSize: "14px",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px"
  },
  durationRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
    marginBottom: "15px"
  },
  durationItem: {
    padding: "10px 12px",
    borderRadius: "8px",
    borderLeft: "3px solid #e74c3c",
    background: "#fef7f7"
  },
  durationLabel: {
    fontSize: "11px",
    color: "#dc2626",
    fontWeight: "700",
    marginBottom: "2px"
  },
  durationValue: {
    fontSize: "16px",
    fontWeight: "800",
    color: "#b91c1c"
  },
  issueDetails: {
    background: "#f8fafc",
    padding: "12px 16px",
    borderRadius: "8px",
    borderLeft: "3px solid #1976d2",
    fontSize: "13px",
    lineHeight: "1.4",
    color: "#374151"
  },
  loading: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "60vh",
    padding: "40px 20px"
  },
  logoutButton: {
    padding: "8px 16px",
    background: "#dc3545",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    whiteSpace: "nowrap"
  },
  logo: {
    width: "70px",
    height: "60px",
    objectFit: "contain"
  }
};

export default function ManagerDashboard() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('all');
  const [customers, setCustomers] = useState([]);

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No token found");

      const res = await API.get("/tickets/escalated", {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log("✅ Tickets loaded:", res.data);
      setTickets(res.data || []);
      setCustomers(Array.from(new Set(res.data.map(t => t.CustomerName).filter(Boolean))).sort());
    } catch (err) {
      console.error("Error:", err);
      if (err.response?.status === 401) {
        localStorage.clear();
        navigate("/", { replace: true });
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const handleDownload = async () => {
    if (!startDate || !endDate) {
      alert("Please select both start and end dates");
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      alert("Start date cannot be after end date");
      return;
    }

    try {
      setDownloadLoading(true);
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        startDate: startDate,
        endDate: endDate,
        customer: selectedCustomer === 'all' ? '' : selectedCustomer
      });

      const res = await API.get(`/tickets/download?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `SAI_Tickets_${startDate}_to_${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download error:", err);
      alert("Failed to download report");
    } finally {
      setDownloadLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/";
  };

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const summary = {
    Total: tickets.length,
    Open: tickets.filter(t => t.Status === "Open").length,
    InProgress: tickets.filter(t => t.Status === "InProgress").length,
    Pending: tickets.filter(t => t.Status === "Pending").length,
    Resolved: tickets.filter(t => t.Status === "Resolved").length
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        <h2 style={{ color: "#6b7280", fontSize: "20px" }}>Loading...</h2>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* DOWNLOAD PANEL */}
      <div style={styles.downloadPanel}>
        <h2 style={styles.downloadTitle}>
          📥 Download Ticket Report
        </h2>
        <div style={styles.filterRow}>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={styles.dateInput}
              max={endDate || new Date().toISOString().split('T')[0]}
            />
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={styles.dateInput}
              min={startDate}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Customer</label>
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              style={styles.customerSelect}
            >
              <option value="all">🌐 Select All Customers</option>
              {customers.map((customer, idx) => (
                <option key={idx} value={customer}>{customer}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleDownload}
            disabled={!startDate || !endDate || downloadLoading}
            style={{
              ...styles.downloadBtn,
              ...(downloadLoading ? styles.downloadBtnDisabled : {})
            }}
          >
            {downloadLoading ? "⏳ Downloading..." : "📊 Download CSV"}
          </button>
        </div>
      </div>

      {/* HEADER */}
      <div style={styles.header}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <img src="/logo.png" alt="SAI Automation" style={styles.logo} />
            <div>
              <h1 style={styles.title}>🚨 SAI Manager Dashboard</h1>
              <div style={styles.headerStats}>
                Total: <strong>{summary.Total}</strong> | Open: <strong style={{color: "#e74c3c"}}>{summary.Open}</strong>
              </div>
            </div>
          </div>
          <button 
            onClick={() => setShowLogoutConfirm(true)}
            style={styles.logoutButton}
          >
            🚪 Logout
          </button>
        </div>
      </div>

      {showLogoutConfirm && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
        }}>
          <div style={{
            background: "white", padding: "28px", borderRadius: "12px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            maxWidth: "380px", width: "90%", textAlign: "center"
          }}>
            <h3 style={{ margin: "0 0 16px 0", color: "#1e293b" }}>🔒 Confirm Logout</h3>
            <p style={{ margin: "0 0 24px 0", color: "#64748b" }}>Are you sure you want to logout?</p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button 
                onClick={() => setShowLogoutConfirm(false)}
                style={{ padding: "10px 20px", background: "#6c757d", color: "white", border: "none", borderRadius: "8px", fontWeight: "600", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button 
                onClick={handleLogout}
                style={{ padding: "10px 20px", background: "#dc3545", color: "white", border: "none", borderRadius: "8px", fontWeight: "600", cursor: "pointer" }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STATUS CARDS */}
      <div style={styles.statusGrid}>
        {Object.entries(summary).map(([key, value]) => (
          <div key={key} style={{
            ...styles.statusCard,
            borderColor: getStatusColor(key),
            background: value > 0 ? getStatusColor(key) + "10" : "white",
            color: value > 0 ? getStatusColor(key) : "#374151"
          }}>
            <div style={styles.statusIcon}>{key === "Total" ? "🚨" : getStatusIcon(key)}</div>
            <div style={styles.statusTitle}>{key}</div>
            <div style={styles.statusCount}>{value}</div>
          </div>
        ))}
      </div>

      {/* TICKETS */}
      {tickets.length === 0 ? (
        <div style={styles.loading}>
          <div style={{ fontSize: "48px", marginBottom: "15px", opacity: 0.5 }}>🚨</div>
          <h3 style={{ margin: 0, color: "#6b7280" }}>No escalated tickets</h3>
        </div>
      ) : (
        <div style={styles.ticketGrid}>
          {tickets.map((t) => (
            <div key={t.TicketID} style={styles.ticketCard}>
              <div style={styles.ticketHeader}>
                <h3 style={styles.ticketNumber}>🎫 {t.TicketNo}</h3>
                <span style={{
                  ...styles.priorityBadge,
                  background: t.priority === "High" ? "#ef4444" : 
                  t.priority === "Medium" ? "#f59e0b" : 
                  t.priority === "Low" ? "#10b981" : "#6b7280"
                }}>
                  {t.priority || 'Normal'}
                </span>
              </div>

              <div style={styles.infoGrid}>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Customer</span>
                  <span style={styles.infoValue}>{t.CustomerName || 'N/A'}</span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Site</span>
                  <span style={styles.infoValue}>{t.SiteName || 'N/A'}</span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Engineer</span>
                  <span style={styles.infoValue}>{t.AssignedTo?.split('@')[0] || 'N/A'}</span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Created</span>
                  <span style={styles.infoValue}>{formatIstDate(t.CreatedTime)}</span>
                </div>
              </div>

              <div style={{
                ...styles.statusDisplay,
                color: getStatusColor(t.Status),
                backgroundColor: getStatusColor(t.Status) + "15"
              }}>
                📍 {getStatusIcon(t.Status)} {t.Status}
              </div>

              <div style={styles.durationRow}>
                {t.InProgress_Date && (
                  <div style={styles.durationItem}>
                    <div style={styles.durationLabel}>⏱️ In Progress</div>
                    <div style={styles.durationValue}>
                      {calculateDuration(t.CreatedTime, t.InProgress_Date)}
                    </div>
                  </div>
                )}
                {t.Pending_Date && !t.Resolved_Date && (
                  <div style={styles.durationItem}>
                    <div style={styles.durationLabel}>⏳ Pending</div>
                    <div style={styles.durationValue}>
                      {calculateDuration(t.Pending_Date)}
                    </div>
                  </div>
                )}
              </div>

              <div style={styles.issueDetails}>
                <strong style={{ fontSize: "13px", color: "#1e40af", marginBottom: "6px", display: "block" }}>
                  📋 {t.IssueDetails || 'No details'}
                </strong>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
