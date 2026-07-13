import { useEffect, useState } from "react";
import API from "../api";

const fieldStyle = {
  minWidth: 0,
  padding: "10px 12px",
  background: "white",
  borderRadius: "8px",
  border: "1px solid #dbeafe"
};

const labelStyle = {
  display: "block",
  marginBottom: "5px",
  color: "#64748b",
  fontSize: "11px",
  fontWeight: "700",
  letterSpacing: "0.4px",
  textTransform: "uppercase"
};

const valueStyle = {
  color: "#1e293b",
  fontSize: "14px",
  fontWeight: "600",
  overflowWrap: "anywhere"
};

const iconButtonStyle = {
  marginLeft: "6px",
  padding: "2px 4px",
  border: "none",
  background: "transparent",
  cursor: "pointer"
};

export default function AmcAccessDetails({ ticket, canRevealPassword = true }) {
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    setPassword("");
    setPasswordVisible(false);
  }, [ticket?.TicketID]);

  const isAmcTicket = ticket?.TicketType === "AMC" || Boolean(ticket?.AmcCustomerId);
  if (!isAmcTicket) return null;

  const copyValue = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value);
      alert(`📋 ${label} copied!`);
    } catch (err) {
      console.error("Clipboard error:", err);
      alert(`❌ Could not copy ${label}. Please copy it manually.`);
    }
  };

  const togglePassword = async () => {
    if (passwordVisible) {
      setPassword("");
      setPasswordVisible(false);
      return;
    }

    try {
      setPasswordLoading(true);
      const res = await API.get(`/tickets/ticket/${ticket.TicketID}/remote-password`);
      setPassword(res.data?.password || "");
      setPasswordVisible(true);
    } catch (err) {
      console.error("Remote password load error:", err);
      alert("❌ " + (err.response?.data?.msg || "Failed to load remote password"));
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div style={{
      marginTop: "18px",
      padding: "16px",
      background: "#eff6ff",
      border: "2px solid #bfdbfe",
      borderRadius: "12px"
    }}>
      <div style={{ marginBottom: "12px", color: "#1565c0", fontWeight: "800", fontSize: "14px" }}>
        📞 AMC Site Contact & Remote Access
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "10px" }}>
        <div style={fieldStyle}>
          <span style={labelStyle}>Contact Person</span>
          <span style={valueStyle}>{ticket.SiteContactName || "—"}</span>
        </div>

        <div style={fieldStyle}>
          <span style={labelStyle}>Contact Phone</span>
          <span style={valueStyle}>
            {ticket.SiteContactPhone || "—"}
            {ticket.SiteContactPhone && (
              <button type="button" aria-label="Copy contact phone" onClick={() => copyValue(ticket.SiteContactPhone, "Phone")} style={iconButtonStyle}>📋</button>
            )}
          </span>
        </div>

        <div style={fieldStyle}>
          <span style={labelStyle}>Remote Tool</span>
          <span style={valueStyle}>{ticket.RemoteTool || "—"}</span>
        </div>

        <div style={fieldStyle}>
          <span style={labelStyle}>Remote ID</span>
          <span style={valueStyle}>
            {ticket.RemoteID || "—"}
            {ticket.RemoteID && (
              <button type="button" aria-label="Copy remote ID" onClick={() => copyValue(ticket.RemoteID, "Remote ID")} style={iconButtonStyle}>📋</button>
            )}
          </span>
        </div>

        <div style={fieldStyle}>
          <span style={labelStyle}>Remote Password</span>
          <span style={valueStyle}>
            {!canRevealPassword
              ? (ticket.HasRemotePassword ? "Restricted to Dispatcher / Assigned Engineer" : "—")
              : ticket.HasRemotePassword
                ? (passwordVisible ? password : "••••••••")
                : "—"}
            {canRevealPassword && ticket.HasRemotePassword && (
              <>
                <button
                  type="button"
                  aria-label={passwordVisible ? "Hide remote password" : "Show remote password"}
                  disabled={passwordLoading}
                  onClick={togglePassword}
                  style={iconButtonStyle}
                >
                  {passwordLoading ? "…" : (passwordVisible ? "🙈" : "👁")}
                </button>
                {passwordVisible && password && (
                  <button type="button" aria-label="Copy remote password" onClick={() => copyValue(password, "Password")} style={iconButtonStyle}>📋</button>
                )}
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
