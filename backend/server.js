require('dotenv').config(); // ✅ correct

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

app.listen(5000, () => {
  console.log("Backend Running: http://localhost:5000");
});
