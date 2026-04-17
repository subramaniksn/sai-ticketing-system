import React, { useState, useCallback, useMemo, useEffect } from "react";
import API from "../api";

// ✅ FIXED STYLES - NO CIRCULAR REFERENCES (input defined FIRST)
const styles = {
  // 1️⃣ BASE INPUT FIRST (referenced by others)
  input: {
    width: "100%",
    padding: "14px 16px",
    border: "2px solid #e9ecef",
    borderRadius: "12px",
    fontSize: "16px",
    background: "white",
    outline: "none"
  },

  // 2️⃣ NOW SAFE TO REFERENCE input
  selectFull: {
    width: "100%",
    padding: "14px 40px 14px 16px",
    border: "2px solid #e9ecef",
    borderRadius: "12px",
    fontSize: "16px",
    backgroundColor: "white",
    backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")",
    backgroundPosition: "right 12px center",
    backgroundRepeat: "no-repeat",
    backgroundSize: "18px",
    appearance: "none",
    outline: "none"
  },

  textareaFull: {
    width: "100%",
    padding: "14px 16px",
    border: "2px solid #e9ecef",
    borderRadius: "12px",
    fontSize: "16px",
    minHeight: "120px",
    resize: "vertical",
    background: "white",
    fontFamily: "inherit",
    outline: "none"
  },

  // COMPLETE RESPONSIVE STYLES
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "60vh",
    padding: "40px 20px",
    textAlign: "center"
  },
  loadingSpinner: {
    width: "48px",
    height: "48px",
    border: "4px solid #f3f3f3",
    borderTop: "4px solid #1976d2",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    marginBottom: "20px"
  },
  container: { 
    minHeight: "100vh", 
    background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    padding: "20px",
    maxWidth: "1400px",
    margin: "0 auto"
  },
  header: {
    background: "white",
    padding: "24px 28px",
    borderRadius: "16px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
    marginBottom: "28px",
    display: "flex",
    flexDirection: "column",
    gap: "12px"
  },
  title: {
    margin: 0,
    fontSize: "28px",
    fontWeight: "700",
    color: "#1a1a1a"
  },
  headerStats: {
    fontSize: "16px",
    color: "#666"
  },
  statusGrid: {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))",  // 👈 160px → 90px
  gap: "12px",  // 👈 20px → 12px
  marginBottom: "20px"  // 👈 28px → 20px
  },
  statusCard: {
    padding: "12px 8px",  // 👈 24px 20px → 12px 8px
    borderRadius: "10px",
    textAlign: "center",
    cursor: "pointer"
  },
  statusIcon: { fontSize: "20px", marginBottom: "4px" },  // 👈 Smaller
  statusTitle: { fontSize: "14px", fontWeight: "600", marginBottom: "8px" },
  statusCount: { fontSize: "20px", fontWeight: "800", lineHeight: 1 },  // 👈 Smaller
  controlsRow: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    marginBottom: "28px"
  },
  resetButton: {
    padding: "12px 24px",
    background: "#6c757d",
    color: "white",
    border: "none",
    borderRadius: "12px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s"
  },
  search: {
    flex: 1,
    padding: "16px 20px 16px 48px",
    border: "2px solid #e9ecef",
    borderRadius: "12px",
    fontSize: "16px",
    backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none'%3e%3ccircle cx='11' cy='11' r='8' stroke='%236b7280' stroke-width='2'/%3e%3cpath d='m21 21-4.35-4.35' stroke='%236b7280' stroke-width='2' stroke-linecap='round'/%3e%3c/svg%3e\")",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "16px center",
    backgroundSize: "20px"
  },
  formSection: { marginBottom: "32px" },
  formCard: {
    background: "white",
    padding: "32px",
    borderRadius: "20px",
    boxShadow: "0 12px 40px rgba(0,0,0,0.1)"
  },
  sectionTitle: {
    margin: "0 0 24px 0",
    fontSize: "24px",
    fontWeight: "700",
    color: "#1a1a1a"
  },
  formRow: { marginBottom: "24px" },
  formRowGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px"
  },
  ticketsSection: { marginTop: "40px" },
  ticketCount: {
    background: "#e3f2fd",
    color: "#1976d2",
    padding: "6px 16px",
    borderRadius: "20px",
    fontSize: "14px",
    fontWeight: "600",
    marginLeft: "12px"
  },
  ticketGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))",
    gap: "24px",
    padding: "20px 0"
  },
  ticketCard: {
    background: "white",
    borderRadius: "16px",
    padding: "28px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
    borderLeft: "5px solid #1976d2",
    transition: "all 0.3s ease"
  },
  ticketHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
    flexWrap: "wrap",
    gap: "12px"
  },
  ticketNumber: {
    fontSize: "24px",
    fontWeight: "800",
    color: "#1976d2"
  },
  priorityBadge: {
    padding: "10px 20px",
    borderRadius: "25px",
    color: "white",
    fontSize: "13px",
    fontWeight: "700"
  },
  ticketInfo: {
    display: "grid",
    gap: "16px",
    marginBottom: "24px"
  },
  infoItem: {
    display: "flex",
    flexDirection: "column",
    gap: "4px"
  },
  infoLabel: {
    fontSize: "12px",
    color: "#6c757d",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: "0.5px"
  },
  infoValue: {
    fontSize: "16px",
    fontWeight: "600",
    color: "#2c3e50"
  },
  statusDisplay: {
    padding: "14px 24px",
    borderRadius: "30px",
    marginBottom: "20px",
    fontWeight: "700",
    fontSize: "16px",
    display: "inline-flex",
    alignItems: "center",
    gap: "10px"
  },
  timestamp: {
    fontSize: "14px",
    color: "#6c757d",
    padding: "12px 0",
    borderLeft: "4px solid #e0e0e0",
    paddingLeft: "20px",
    margin: "12px 0"
  },
  issueRow: {
    marginTop: "24px",
    paddingTop: "24px",
    borderTop: "2px solid #f0f0f0",
    display: "flex",
    flexDirection: "column",
    gap: "8px"
  },
  issueLabel: {
    fontSize: "14px",
    color: "#6c757d",
    fontWeight: "600"
  },
  issueText: {
    fontSize: "15px",
    color: "#2c3e50",
    lineHeight: "1.6"
  },
  emptyState: {
    textAlign: "center",
    padding: "100px 60px",
    background: "white",
    borderRadius: "24px",
    border: "3px dashed #e0e0e0",
    color: "#6c757d",
    maxWidth: "500px",
    margin: "40px auto"
  },
  emptyIcon: {
    fontSize: "80px",
    marginBottom: "24px",
    opacity: 0.6
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
  transition: "all 0.2s",
  whiteSpace: "nowrap"
  },
  logoutModal: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000
  },
  logoutModalContent: {
    background: "white",
    padding: "32px",
    borderRadius: "16px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
    maxWidth: "400px",
    width: "90%",
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
  },
  compactForm: {
    background: "white",
    padding: "24px",
    borderRadius: "16px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
    marginBottom: "24px"
  },
  compactSectionTitle: {
    margin: "0 0 20px 0",
    fontSize: "20px",
    fontWeight: "700",
    color: "#1a1a1a"
  },
  compactFormRow: {
    marginBottom: "18px"
  },
  compactFormGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px"
  },
  compactInput: {
    padding: "12px 14px",
    fontSize: "14px",
    border: "2px solid #e9ecef",
    borderRadius: "10px",
    background: "white"
  },
  label: {
    marginBottom: "3px",     // 👈 Ultra-tight
    fontWeight: "600",
    color: "#555",
    fontSize: "11px",        // 👈 Tiny text
    textTransform: "uppercase",
    letterSpacing: "0.2px"
  },
  createButton: {  // 👈 ADD THIS (compact version)
    width: "100%",
    padding: "14px 24px",
    background: "linear-gradient(135deg, #1976d2 0%, #1565c0 100%)",
    color: "white",
    border: "none",
    borderRadius: "12px",
    fontSize: "15px",
    fontWeight: "700",
    cursor: "pointer"
  }

};

// ✅ DATETIME UTILITY
const formatIstDate = (dateString) => {
  if (!dateString) return '';

  const date = new Date(dateString);

  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
};

export default function DispatcherDashboard() {
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [hovered, setHovered] = useState("");
  
  const [amcCustomers, setAmcCustomers] = useState([]);
  const [amcLoading, setAmcLoading] = useState(false);

  const engineers = [
    "sarumathy@saiautomation.co.in",
    "vishva@saiautomation.co.in",
    "jeeva@saiautomation.co.in",
    "lakshman@saiautomation.co.in",
    "sujith@saiautomation.co.in",
    "mani@saiautomation.co.in",
    "Jayasankar@saiautomation.co.in",
    "tinu@saiautomation.co.in"
  ];

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const [form, setForm] = useState({
    customerName: "",
    siteName: "",
    issueDetails: "",
    priority: "Medium",
    assignedTo: engineers[0],
    ticketType: "NON_AMC",        // 🔥 NEW
    isAmcCustomer: false,
    amcCustomerId: ""
  });

  const loadAmcCustomers = useCallback(async () => {
    try {
      setAmcLoading(true);
      const token = localStorage.getItem("token");
      const res = await API.get("/tickets/amc", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAmcCustomers(res.data || []);
      console.log("✅ Loaded", res.data?.length || 0, "AMC customers from DB");
    } catch (err) {
      console.error("AMC customers load error:", err);
    } finally {
      setAmcLoading(false);
    }
  }, []);

  const loadTickets = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await API.get("/tickets/all", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTickets(res.data || []);
    } catch (err) {
      console.error("Tickets load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAmcCustomers();
    loadTickets();
  }, [loadAmcCustomers, loadTickets]);
  // 🔥 AUTO-FILL Customer/Site when AMC site selected
// 🔥 AUTO-FILL Customer/Site when AMC site selected
useEffect(() => {
  if (form.ticketType === "AMC" && form.amcCustomerId && amcCustomers.length > 0) {
    const customer = amcCustomers.find(c => c.CustomerID.toString() === form.amcCustomerId);
    if (customer) {
      // ✅ FUNCTIONAL UPDATE - NO ESLint warning!
      setForm(prevForm => ({
        ...prevForm,
        customerName: customer.CustomerName || "",
        siteName: customer.SiteName || ""
      }));
      console.log("✅ AUTO-FILLED:", customer.CustomerName, " - ", customer.SiteName);
    }
  }
}, [form.ticketType, form.amcCustomerId, amcCustomers]); // ✅ Perfect deps


  const createTicket = async () => {
    // ✅ FIXED: Smart validation for AMC vs Manual
    const isAmcTicket = form.ticketType === "AMC" && form.amcCustomerId;
    const hasManualDetails = form.customerName?.trim() && form.siteName?.trim();

    if (!form.issueDetails?.trim()) {
      alert("❌ Issue Details are required");
      return;
    }

    if (!isAmcTicket && !hasManualDetails) {
      alert("❌ Customer Name and Site Name are required for Manual Entry tickets");
      return;
    }

    try {
      setCreating(true);
      const token = localStorage.getItem("token");
      
      const payload = {
        customerName: form.customerName,
        siteName: form.siteName,
        issueDetails: form.issueDetails,
        priority: form.priority,
        assignedTo: form.assignedTo,
        ticketType: form.ticketType,                    // 🔥 NEW
        ...(form.ticketType === "AMC" && { amcCustomerId: parseInt(form.amcCustomerId) })
      };

      const res = await API.post("/tickets/create", payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert(`✅ Ticket Created!\nTicket No: ${res.data.ticketNo}`);
      
      setForm({
        customerName: "",
        siteName: "",
        issueDetails: "",
        priority: "Medium",
        assignedTo: engineers[0],
        ticketType: "NON_AMC",       // 🔥 NEW
        isAmcCustomer: false,
        amcCustomerId: ""
      });
      
      loadTickets();
    } catch (err) {
      console.error("Create ticket error:", err);
      alert("❌ Failed to create ticket: " + (err.response?.data?.msg || "Please try again"));
    } finally {
      setCreating(false);
    }
  };


  const handleInputChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/"; // Direct redirect to login
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Open": return "#e20022";
      case "InProgress": return "#fef032";
      case "Pending": return "#1c7ad5";
      case "Resolved": return "#39c62c";
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

  const summary = useMemo(() => {
    const total = tickets.length;
    return {
      Total: total,
      Open: tickets.filter(t => t.Status === "Open").length,
      InProgress: tickets.filter(t => t.Status === "InProgress").length,
      Pending: tickets.filter(t => t.Status === "Pending").length,
      Resolved: tickets.filter(t => t.Status === "Resolved").length
    };
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const s = search.toLowerCase();
      const matchesSearch =
        (t.TicketNo || "").toLowerCase().includes(s) ||
        (t.CustomerName || "").toLowerCase().includes(s) ||
        (t.SiteName || "").toLowerCase().includes(s) ||
        (t.IssueDetails || "").toLowerCase().includes(s) ||
        (t.AssignedTo || "").toLowerCase().includes(s);
      const matchesStatus = statusFilter ? t.Status === statusFilter : true;
      return matchesSearch && matchesStatus;
    });
  }, [tickets, statusFilter, search]);

  const StatusCard = ({ title, count, isActive, isHovered, color, icon, onClick, onHover, onHoverOut }) => (
    <div
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onHoverOut}
      style={{
        ...styles.statusCard,
        background: isActive ? (color || "#1976d2") : "#ffffff",
        color: isActive ? "#fff" : "#333",
        borderColor: isActive ? (color || "#1976d2") : "#e0e0e0",
        transform: isHovered ? "translateY(-4px)" : "none",
        boxShadow: isHovered ? "0 12px 24px rgba(0,0,0,0.15)" : "0 4px 12px rgba(0,0,0,0.08)",
      }}
    >
      <div style={styles.statusIcon}>{icon}</div>
      <div style={styles.statusTitle}>{title}</div>
      <div style={styles.statusCount}>{count}</div>
    </div>
  );

  const TicketCard = ({ ticket }) => (
  <div style={styles.ticketCard}>
    
    <div style={styles.ticketHeader}>
      <div style={styles.ticketNumber}>🎫 {ticket.TicketNo}</div>

      <span style={{
        ...styles.priorityBadge,
        background:
          ticket.priority === "High" ? "#e20022" :
          ticket.priority === "Medium" ? "#f15f13" :
          ticket.priority === "Low" ? "#39c62c" : "#95a5a6"
      }}>
        {ticket.priority}
      </span>
    </div>

    <div style={styles.ticketInfo}>
      <div style={styles.infoItem}>
        <span style={styles.infoLabel}>Customer</span>
        <span style={styles.infoValue}>{ticket.CustomerName}</span>
      </div>

      <div style={styles.infoItem}>
        <span style={styles.infoLabel}>Site</span>
        <span style={styles.infoValue}>{ticket.SiteName}</span>
      </div>

      {/* 🔥 REASSIGN DROPDOWN */}
      <div style={styles.infoItem}>
        <span style={styles.infoLabel}>Engineer</span>

        <select
          value={ticket.AssignedTo}
          onChange={(e) =>
            handleReassign(ticket.TicketID, e.target.value)
          }
          style={{ padding: "8px", borderRadius: "8px" }}
        >
          {engineers.map(e => (
            <option key={e} value={e}>
              {e.split('@')[0]}
            </option>
          ))}
        </select>
      </div>
    </div>

    <div style={{
      ...styles.statusDisplay,
      color: getStatusColor(ticket.Status),
      backgroundColor: getStatusColor(ticket.Status) + "20"
    }}>
      📍 {getStatusIcon(ticket.Status)} {ticket.Status}
    </div>

    {/* 🔥 CREATED DATE */}
    {ticket.CreatedTime && (
      <div style={styles.timestamp}>
        🕒 Created: {formatIstDate(ticket.CreatedTime)}
      </div>
    )}

    {ticket.InProgress_Date && (
      <div style={styles.timestamp}>
        🚀 Started: {formatIstDate(ticket.InProgress_Date)}
      </div>
    )}

    {ticket.Pending_Date && (
      <div style={styles.timestamp}>
        ⏳ Pending: {formatIstDate(ticket.Pending_Date)}
      </div>
    )}

    {ticket.Resolved_Date && (
      <div style={styles.timestamp}>
        ✅ Resolved: {formatIstDate(ticket.Resolved_Date)}
      </div>
    )}

    <div style={styles.issueRow}>
      <span style={styles.issueLabel}>Issue:</span>
      <span style={styles.issueText}>{ticket.IssueDetails}</span>
    </div>

    {/* 🔥 NEW: REMARKS SECTION */}
    {ticket.Remark && (
      <div style={styles.issueRow}>
        <span style={styles.issueLabel}>Remarks:</span>
        <span style={styles.issueText}>{ticket.Remark}</span>
      </div>
    )}
  </div>
);

  if (loading || amcLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingSpinner}></div>
        <h2>Loading Dashboard...</h2>
      </div>
    );
  }
const handleReassign = async (ticketId, newEngineer) => {
  try {
    const token = localStorage.getItem("token");

    await API.put(`/tickets/reassign/${ticketId}`, {
      assignedTo: newEngineer
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    // ✅ Update UI instantly (no reload)
    setTickets(prev =>
      prev.map(t =>
        t.TicketID === ticketId
          ? { ...t, AssignedTo: newEngineer }
          : t
      )
    );

    alert("✅ Reassigned successfully");
  } catch (err) {
    console.error(err);
    alert("❌ Failed to reassign");
  }
};

// ✅ PUT THIS ABOVE return (inside component)
const th = {
  padding: "12px",
  textAlign: "left",
  fontSize: "14px"
};

const td = {
  padding: "12px",
  fontSize: "14px"
};
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {/* ✅ SAI LOGO */}
            <img src="/logo.png" alt="SAI Automation" style={styles.logo} />
            <div>
              <h1 style={styles.title}>📋 SAI Dispatcher Dashboard</h1>
              <div style={styles.headerStats}>
                Total: <strong>{summary.Total}</strong> | Open: <strong style={{color: getStatusColor('Open')}}>{summary.Open}</strong>
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
        <div style={styles.logoutModal}>
          <div style={styles.logoutModalContent}>
            <h3>🔒 Confirm Logout</h3>
            <p>Are you sure you want to logout?</p>
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
      {/* Status Cards */}
      <div style={styles.statusGrid}>
        {Object.entries(summary).map(([key, value]) => (
          <StatusCard 
            key={key}
            title={key}
            count={value}
            isActive={statusFilter === key}
            isHovered={hovered === key}
            color={getStatusColor(key)}
            icon={key === "Total" ? "📊" : getStatusIcon(key)}
            onClick={() => setStatusFilter(key === "Total" ? "" : key)}
            onHover={() => setHovered(key)}
            onHoverOut={() => setHovered("")}
          />
        ))}
      </div>

      {/* Controls */}
      <div style={styles.controlsRow}>
        {statusFilter && statusFilter !== "Total" && (
          <button style={styles.resetButton} onClick={() => setStatusFilter("")}>
            🔄 Show All ({tickets.length})
          </button>
        )}
        <input
          style={styles.search}
          placeholder="🔍 Search tickets, customers, engineers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Create Form */}
      <div style={styles.formSection}>
        <div style={styles.formCard}>
          <h3 style={styles.sectionTitle}>➕ Create New Ticket ({amcCustomers.length} AMC Available)</h3>

            {/* 1️⃣ TICKET TYPE SELECTOR */}
            <div style={styles.formRowGrid}>
              <div>
                <label style={styles.label}>🎫 Ticket Type *</label>
                <select 
                  name="ticketType"
                  value={form.ticketType}
                  onChange={handleInputChange}
                  disabled={creating}
                  style={styles.input}
                >
                  <option value="NON_AMC">👤 Manual Entry</option>
                  <option value="AMC">🏢 AMC Customer</option>
                </select>
              </div>
            </div>

            {/* 2️⃣ AMC CUSTOMER DROPDOWN - ONLY WHEN AMC SELECTED */}
            {form.ticketType === "AMC" && (
              <div style={styles.formRow}>
                <label style={styles.label}>🏢 AMC Site *</label>
                <select 
                  name="amcCustomerId"
                  value={form.amcCustomerId}
                  onChange={handleInputChange}
                  disabled={creating}
                  style={styles.input}
                >
                  <option value="">-- Select AMC Site ({amcCustomers.length}) --</option>
                  {amcCustomers.map(customer => (
                    <option key={customer.CustomerID} value={customer.CustomerID}>
                      {customer.CustomerName} - {customer.SiteName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 3️⃣ MANUAL FIELDS - ONLY WHEN NON_AMC SELECTED */}
            {form.ticketType === "NON_AMC" && (
              <div style={styles.formRowGrid}>
                <div>
                  <label style={styles.label}>Customer Name *</label>
                  <input 
                    name="customerName" 
                    placeholder="Enter customer name" 
                    value={form.customerName}
                    onChange={handleInputChange} 
                    disabled={creating} 
                    style={styles.input} 
                  />
                </div>
                <div>
                  <label style={styles.label}>Site Name *</label>
                  <input 
                    name="siteName" 
                    placeholder="Enter site location" 
                    value={form.siteName}
                    onChange={handleInputChange} 
                    disabled={creating} 
                    style={styles.input} 
                  />
                </div>
              </div>
            )}

          <div style={styles.formRow}>
            <label style={styles.label}>Issue Details *</label>
            <textarea 
              name="issueDetails" 
              placeholder="Describe the technical issue..." 
              value={form.issueDetails}
              onChange={handleInputChange} 
              disabled={creating} 
              rows={4} 
              style={styles.textareaFull} 
            />
          </div>

          <div style={styles.formRowGrid}>
            <div>
              <label style={styles.label}>Priority</label>
              <select name="priority" value={form.priority} onChange={handleInputChange} disabled={creating} style={styles.input}>
                <option value="High">🔴 High (2H SLA)</option>
                <option value="Medium">🟠 Medium (8H SLA)</option>
                <option value="Low">🟢 Low (24H SLA)</option>
              </select>
            </div>
            <div>
              <label style={styles.label}>Assign Engineer</label>
              <select name="assignedTo" value={form.assignedTo} onChange={handleInputChange} disabled={creating} style={styles.input}>
                {engineers.map(e => (
                  <option key={e} value={e}>{e.split('@')[0]}</option>
                ))}
              </select>
            </div>
          </div>

          <button 
            onClick={createTicket} 
            disabled={creating} 
            style={{
              ...styles.createButton,
              opacity: creating ? 0.7 : 1,
              cursor: creating ? "not-allowed" : "pointer"
            }}
          >
            {creating ? "🎫 Creating Ticket..." : "✅ Create Ticket Now"}
          </button>
        </div>
      </div>

      {/* Tickets List */}
      <div style={styles.ticketsSection}>
        <h3 style={styles.sectionTitle}>
          📋 All Tickets {statusFilter ? `• ${statusFilter}` : ''} 
          <span style={styles.ticketCount}>({filteredTickets.length})</span>
        </h3>
        
        {filteredTickets.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📭</div>
            <h4>No tickets match your filter</h4>
            <p>Try adjusting search or status filter above</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "350px", background: "white", borderRadius: "12px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#1976d2", color: "white" }}>
                  <th style={th}>Ticket No</th>
                  <th style={th}>Customer</th>
                  <th style={th}>Site</th>
                  <th style={th}>Engineer</th>
                  <th style={th}>Priority</th>
                  <th style={th}>Status</th>
                  <th style={th}>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredTickets.map(ticket => (
                  <tr key={ticket.TicketID} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={td}>{ticket.TicketNo}</td>
                    <td style={td}>{ticket.CustomerName}</td>
                    <td style={td}>{ticket.SiteName}</td>

                    {/* 🔥 REASSIGN DROPDOWN */}
                    <td style={td}>
                      <select
                        value={ticket.AssignedTo}
                        onChange={(e) =>
                          handleReassign(ticket.TicketID, e.target.value)
                        }
                        style={{ padding: "6px", borderRadius: "6px" }}
                      >
                        {engineers.map(e => (
                          <option key={e} value={e}>
                            {e.split("@")[0]}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td style={td}>{ticket.priority}</td>

                    <td style={td}>
                      <span style={{
                        padding: "6px 10px",
                        borderRadius: "20px",
                        background: getStatusColor(ticket.Status) + "20",
                        color: getStatusColor(ticket.Status),
                        fontWeight: "600"
                      }}>
                        {ticket.Status}
                      </span>
                    </td>

                    <td style={td}>
                      <button
                        onClick={() => setSelectedTicket(ticket)}
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
          
        )}
      </div>
      {selectedTicket && (
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 2000
      }}>
        <div style={{
          width: "90%",
          maxWidth: "600px",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "white",
          borderRadius: "16px",
          padding: "20px",
          position: "relative"
        }}>
          
          {/* CLOSE BUTTON */}
          <button
            onClick={() => setSelectedTicket(null)}
            style={{
              position: "absolute",
              top: "10px",
              right: "10px",
              background: "#dc3545",
              color: "white",
              border: "none",
              padding: "6px 10px",
              borderRadius: "6px",
              cursor: "pointer"
            }}
          >
            ❌ Close
          </button>

          {/* 🔥 REUSE YOUR CARD UI */}
          <TicketCard ticket={selectedTicket} />
        </div>
      </div>
    )}
    </div>
  );
}
