// app.js
const express = require("express");
const app = express();
require("dotenv").config();

// Middleware
app.use(express.json());

// Routes
app.use("/patient", require("./routes/patient.routes"));
app.use("/doctor", require("./routes/doctor.routes"));

// Root endpoint
app.get("/", (req, res) => {
  res.send("Server running 🚀");
});

module.exports = app; // ✅ export app, do NOT call app.listen here
