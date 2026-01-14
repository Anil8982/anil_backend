// app.js
const express = require("express");
const app = express();
require("dotenv").config();
// require("./cron/reminderJob");

// Middleware
app.use(express.json());

// Routes
app.use("/patient", require("./routes/patient.routes"));
app.use("/doctor", require("./routes/doctor.routes"));
app.use("/admin", require("./routes/admin.routes"));
app.use("/notifications", require("./routes/notification.routes"));

// Root endpoint
app.get("/", (req, res) => {
  res.send("Server running 🚀");
});

module.exports = app;
