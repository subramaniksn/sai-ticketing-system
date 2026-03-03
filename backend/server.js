require('dotenv').config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const ticketRoutes = require("./routes/ticketRoutes");
const runEscalationJob = require("./escalationJob");

const app = express();

app.use(cors());
app.use(express.json());

setInterval(runEscalationJob, 5 * 60 * 1000);

app.use("/api/auth", authRoutes);
app.use("/api/tickets", ticketRoutes);

if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  app.use(express.static(path.join(__dirname, '../frontend/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
  });
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Ticketing Server running on port ${PORT}`);
});

