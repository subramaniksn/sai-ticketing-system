import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [userData, setUserData] = useState(null);
  const [newPassword, setNewPassword] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const loginUser = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${process.env.REACT_APP_API_URL || 'http://35.154.47.168:5000'}/api/auth/login`, form);
      
      // 🔥 FIRST TIME LOGIN CHECK
      if (res.data.firstTimeLogin) {
        setUserData(res.data.user);
        setShowPasswordModal(true);
        setLoading(false);
        return;
      }

      // Normal login
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("role", res.data.role);
      axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;

      switch (res.data.role) {
        case "Dispatcher": 
          navigate("/dispatcher", { replace: true }); 
          break;
        case "Engineer": 
          navigate("/engineer", { replace: true }); 
          break;
        case "Manager": 
          navigate("/manager", { replace: true }); 
          break;
        default: 
          navigate("/", { replace: true });
      }
    } catch (err) {
      alert("Login Failed: " + (err.response?.data?.msg || err.message || "Server error"));
    } finally {
      setLoading(false);
    }
  };

  // 🔥 HANDLE PASSWORD CHANGE
  const handlePasswordChange = async () => {
    if (newPassword.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }

    try {
      setLoading(true);
      const res = await axios.post(`${process.env.REACT_APP_API_URL || 'http://35.154.47.168:5000'}/api/auth/set-password`, {
        userId: userData.userId,
        email: userData.email,
        newPassword
      });

      if (res.data.success) {
        alert("✅ Password set successfully! Please login again with new password.");
        setShowPasswordModal(false);
        setNewPassword("");
        setForm({ email: form.email, password: "" }); // Keep email, clear password
      }
    } catch (err) {
      alert("Failed to update password: " + (err.response?.data?.msg || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Left Side - Illustration */}
      <div style={styles.leftPanel}>
        <div style={styles.illustration}>
          <div style={styles.icons}>
            <div style={styles.iconBubble}>📧</div>
            <div style={styles.iconBubble}>🧑‍💻</div>
            <div style={styles.iconBubble}>📱</div>
          </div>
          <div style={styles.manImage}>🧑‍💼</div>
          <div style={styles.tableImage}>💻</div>
        </div>
        <div style={styles.leftText}>
          <h1 style={styles.leftTitle}>Ticket Support System</h1>
          <p style={styles.leftSubtitle}>Streamlined customer support management</p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div style={styles.rightPanel}>
        <div style={styles.formContainer}>
          <div style={styles.welcome}>
            <img 
              src="/logo.png" 
              alt="SAI Automation" 
              style={styles.logo}
            />
            <h1 style={styles.welcomeTitle}>Hello, Ticket Support</h1>
            <p style={styles.welcomeText}>Enter your credentials to access dashboard</p>
          </div>

          <form 
            style={styles.form} 
            onSubmit={(e) => { e.preventDefault(); loginUser(); }}
          >
            <div style={styles.inputGroup}>
              <label style={styles.label}>Email</label>
              <input
                name="email"
                type="email"
                placeholder="Enter your email"
                value={form.email}
                onChange={handleChange}
                disabled={loading || showPasswordModal}
                style={styles.input}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Password</label>
              <input
                name="password"
                type="password"
                placeholder="Enter your password"
                value={form.password}
                onChange={handleChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    loginUser();
                  }
                }}
                disabled={loading || showPasswordModal}
                style={styles.input}
              />
            </div>

            <button
              type="submit"
              disabled={!form.email || !form.password || loading || showPasswordModal}
              style={{
                ...styles.loginButton,
                opacity: (!form.email || !form.password || loading || showPasswordModal) ? 0.6 : 1,
                cursor: (!form.email || !form.password || loading || showPasswordModal) ? "not-allowed" : "pointer"
              }}
            >
              {loading ? "🔄 Logging in..." : "🚀 Login"}
            </button>
          </form>
        </div>
      </div>

      {/* 🔥 FIRST TIME PASSWORD CHANGE MODAL */}
      {showPasswordModal && (
        <div style={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && setShowPasswordModal(false)}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>🔐 First Time Login</h3>
            <p style={styles.modalSubtitle}>
              Welcome <strong>{userData?.email}</strong>! 
              Please set a new secure password to continue.
            </p>
            
            <div style={styles.inputGroup}>
              <label style={styles.label}>New Password <span style={{color: '#ef4444'}}>*</span></label>
              <input
                type="password"
                placeholder="Enter new password (minimum 6 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{
                  ...styles.input,
                  borderColor: newPassword.length > 0 && newPassword.length < 6 ? '#f87171' : '#d1d5db',
                  borderWidth: newPassword.length > 0 ? '2px' : '1px'
                }}
                disabled={loading}
              />
              {newPassword.length > 0 && newPassword.length < 6 && (
                <small style={styles.errorText}>Password must be at least 6 characters</small>
              )}
              {newPassword.length >= 6 && (
                <small style={styles.successText}>✓ Password meets requirements</small>
              )}
            </div>

            <div style={styles.modalButtons}>
              <button
                onClick={handlePasswordChange}
                disabled={newPassword.length < 6 || loading}
                style={{
                  ...styles.loginButton,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  flex: 2,
                  opacity: (newPassword.length < 6 || loading) ? 0.6 : 1,
                  cursor: (newPassword.length < 6 || loading) ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? "⏳ Updating..." : "✅ Set New Password"}
              </button>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setNewPassword("");
                }}
                disabled={loading}
                style={{
                  ...styles.cancelButton,
                  opacity: loading ? 0.6 : 1,
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    minHeight: "100vh",
    background: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  leftPanel: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    padding: "60px 40px",
    background: "rgba(255,255,255,0.1)",
    backdropFilter: "blur(10px)"
  },
  illustration: {
    position: "relative",
    width: "300px",
    height: "300px",
    marginBottom: "40px"
  },
  icons: {
    position: "absolute",
    top: "20px",
    right: "-20px",
    display: "flex",
    flexDirection: "column",
    gap: "15px"
  },
  iconBubble: {
    width: "60px",
    height: "60px",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "24px",
    backdropFilter: "blur(10px)"
  },
  manImage: {
    position: "absolute",
    bottom: "0",
    left: "20px",
    fontSize: "140px",
    filter: "drop-shadow(0 10px 20px rgba(0,0,0,0.2))"
  },
  tableImage: {
    position: "absolute",
    bottom: "40px",
    right: "0",
    fontSize: "80px"
  },
  leftText: {
    textAlign: "center",
    color: "white"
  },
  leftTitle: {
    fontSize: "32px",
    fontWeight: "800",
    margin: 0,
    marginBottom: "12px",
    textShadow: "0 2px 10px rgba(0,0,0,0.3)"
  },
  leftSubtitle: {
    fontSize: "18px",
    opacity: 0.9,
    margin: 0
  },
  rightPanel: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px",
    background: "rgba(255,255,255,0.95)",
    backdropFilter: "blur(20px)"
  },
  formContainer: {
    width: "100%",
    maxWidth: "420px"
  },
  welcome: {
    marginBottom: "40px",
    textAlign: "center"
  },
  welcomeTitle: {
    fontSize: "36px",
    fontWeight: "800",
    color: "#1e293b",
    margin: 0,
    marginBottom: "8px"
  },
  welcomeText: {
    fontSize: "16px",
    color: "#64748b",
    margin: 0
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "24px"
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px"
  },
  label: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#374151"
  },
  input: {
    width: "100%",
    padding: "16px 20px",
    border: "2px solid #e2e8f0",
    borderRadius: "12px",
    fontSize: "16px",
    background: "white",
    transition: "all 0.3s ease",
    outline: "none",
    boxSizing: "border-box"
  },
  loginButton: {
    width: "100%",
    padding: "18px",
    background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
    color: "white",
    border: "none",
    borderRadius: "12px",
    fontSize: "16px",
    fontWeight: "700",
    cursor: "pointer",
    transition: "all 0.3s ease",
    boxShadow: "0 10px 25px rgba(59,130,246,0.4)"
  },
  logo: {
    width: "160px",
    height: "auto",
    marginBottom: "20px",
    filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.1))"
  },
  // 🔥 NEW MODAL STYLES
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modal: {
    background: 'white',
    padding: '40px',
    borderRadius: '20px',
    width: '90%',
    maxWidth: '500px',
    boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
    maxHeight: '90vh',
    overflowY: 'auto'
  },
  modalTitle: {
    fontSize: '28px',
    fontWeight: '800',
    color: '#1e293b',
    margin: '0 0 16px 0',
    textAlign: 'center'
  },
  modalSubtitle: {
    fontSize: '16px',
    color: '#64748b',
    margin: '0 0 32px 0',
    textAlign: 'center',
    lineHeight: '1.6'
  },
  modalButtons: {
    display: 'flex',
    gap: '12px',
    marginTop: '8px'
  },
  cancelButton: {
    flex: 1,
    padding: '16px',
    background: '#f1f5f9',
    color: '#475569',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    border: '2px solid #e2e8f0'  // Single border property
  },
  errorText: {
    color: '#f87171',
    fontSize: '14px',
    marginTop: '4px',
    fontWeight: '500'
  },
  successText: {
    color: '#10b981',
    fontSize: '14px',
    marginTop: '4px',
    fontWeight: '500'
  }
};
