// // app.js
// const express = require("express");
// const app = express();
// require("dotenv").config();

// /* =============================== */
// const eventBus = require("./events/eventBus");
// const events = require("./events/notification.events");
// const handlers = require("./notifications/notification.handler");

// // Appointment lifecycle
// eventBus.on(events.APPOINTMENT_REQUESTED, handlers.handleAppointmentRequested);
// eventBus.on(events.APPOINTMENT_CONFIRMED, handlers.handleAppointmentConfirmed);
// eventBus.on(events.APPOINTMENT_REJECTED, handlers.handleAppointmentRejected);
// eventBus.on(
//   events.APPOINTMENT_CANCELLED_BY_PATIENT,
//   handlers.handleAppointmentCancelledByPatient,
// );
// eventBus.on(
//   events.APPOINTMENT_CANCELLED_BY_ADMIN,
//   handlers.handleAppointmentCancelledByAdmin,
// );
// eventBus.on(events.APPOINTMENT_COMPLETED, handlers.handleAppointmentCompleted);

// // Reminders
// eventBus.on(events.APPOINTMENT_REMINDER, handlers.handleAppointmentReminder);

// // Doctor onboarding
// eventBus.on(events.DOCTOR_APPROVED, handlers.handleDoctorApproved);
// eventBus.on(events.DOCTOR_REJECTED, handlers.handleDoctorRejected);

// // Visit summary
// eventBus.on(events.VISIT_SUMMARY_ADDED, handlers.handleVisitSummaryAdded);

// // Middleware
// app.use(express.json());

// // Routes
// app.use("/auth", require("./routes/auth.routes"));
// app.use("/patient", require("./routes/patient.routes"));
// app.use("/doctor", require("./routes/doctor.routes"));
// app.use("/admin", require("./routes/admin.routes"));
// app.use("/notifications", require("./routes/notification.routes"));
// app.use("/uploads", express.static("uploads"));

// // app.use("api/webhook", webhookRoutes)

// // Root endpoint
// app.get("/", (req, res) => {
//   res.send("Server running 🚀");
// });

// module.exports = app;


const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const path = require("path");

/* CORS (MOST IMPORTANT FIX) EVENT LISTENER WIRING (STEP 4.B)*/

const eventBus = require("./events/eventBus");
const events = require("./events/notification.events");
const handlers = require("./notifications/notification.handler");

// Appointment lifecycle
eventBus.on(events.APPOINTMENT_REQUESTED, handlers.handleAppointmentRequested);
eventBus.on(events.APPOINTMENT_CONFIRMED, handlers.handleAppointmentConfirmed);
eventBus.on(events.APPOINTMENT_REJECTED, handlers.handleAppointmentRejected);
eventBus.on(
  events.APPOINTMENT_CANCELLED_BY_PATIENT,
  handlers.handleAppointmentCancelledByPatient,
);
eventBus.on(
  events.APPOINTMENT_CANCELLED_BY_ADMIN,
  handlers.handleAppointmentCancelledByAdmin,
);
eventBus.on(events.APPOINTMENT_COMPLETED, handlers.handleAppointmentCompleted);

// Reminders
eventBus.on(events.APPOINTMENT_REMINDER, handlers.handleAppointmentReminder);

// Doctor onboarding
eventBus.on(events.DOCTOR_APPROVED, handlers.handleDoctorApproved);
eventBus.on(events.DOCTOR_REJECTED, handlers.handleDoctorRejected);

// Visit summary
eventBus.on(events.VISIT_SUMMARY_ADDED, handlers.handleVisitSummaryAdded);

// Middleware
app.use(express.json());

// Routes
app.use("/auth", require("./routes/auth.routes"));
app.use("/patient", require("./routes/patient.routes"));
app.use("/doctor", require("./routes/doctor.routes"));
app.use("/admin", require("./routes/admin.routes"));
app.use("/notifications", require("./routes/notification.routes"));
app.use("/uploads", express.static("uploads"));

// Root endpoint
app.get("/", (req, res) => {
  res.send("Server running 🚀");
});

module.exports = app;
