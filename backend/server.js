require('dotenv').config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const ticketRoutes = require("./routes/ticketRoutes");
const runEscalationJob = require("./escalationJob");

const app = express();

app.use(cors());
app.use(express.json());

// 🔁 Escalation job (runs every 5 mins)
setInterval(runEscalationJob, 5 * 60 * 1000);

// ✅ ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/tickets", ticketRoutes);  // main ticket routes
app.use("/api", ticketRoutes);          // for /api/users/engineers

// 🌐 Production build
if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  app.use(express.static(path.join(__dirname, '../frontend/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
  });
}

// 🚀 Start server
const PORT = process.env.PORT || 5001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Ticketing Server running on port ${PORT}`);
});