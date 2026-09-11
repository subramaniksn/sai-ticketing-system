require('dotenv').config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const ticketRoutes = require("./routes/ticketRoutes");
const { startEscalationJob } = require("./escalationJob");
const { createEmailIntakeJob } = require("./emailIntakeJob");
const emailService = require("./emailService");

const app = express();

app.use(cors());
app.use(express.json());

// ✅ ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api", ticketRoutes);

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

  if (emailService.isConfigured()) {
    startEscalationJob();
    createEmailIntakeJob().start();
  } else {
    console.warn("Microsoft email automation disabled: complete the MS_* and SUPPORT_MAILBOX settings");
  }
});
