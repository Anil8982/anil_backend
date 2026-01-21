const express = require("express");
const router = express.Router();
const doctorController = require("../controllers/doctorController");
// const authController = require("../controllers/authController");
const { verifyToken } = require("../middleware/auth");
const { allowRoles } = require("../middleware/roles");
const { requireActiveUser } = require("../middleware/activeUser");

// Auth
router.post("/register", doctorController.register);
// router.post("/login", authController.login);

// Dashboard
router.get(
  "/dashboard",
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.getDashboard
);

// Profile
router.get(
  "/profile",
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.getDoctorProfile
);

router.put(
  "/profile",
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.updateDoctorProfile
);

// Availability
router.put(
  "/availability",
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.updateAvailability
);

// Appointments
router.get(
  "/appointments/incoming",
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.getIncomingAppointments
);

router.put(
  "/respond-appointment/:id",
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.respondAppointment
);

router.get(
  "/appointments/today-queue",
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.getTodayQueue
);

router.put(
  "/appointments/:id/start",
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.startAppointment
);

router.put(
  "/appointments/:id/complete",
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.completeAppointment
);

router.post(
  "/appointments/next-token",
  verifyToken,
  requireActiveUser,
  allowRoles("DOCTOR"),
  doctorController.callNextToken
);

router.get(
  "/appointments/history",
  verifyToken,
  requireActiveUser,
  allowRoles("DOCTOR"),
  doctorController.getDoctorAppointmentHistory
);

// Notifications
router.get(
  "/notifications",
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.getDoctorNotifications
);

// router.put(
//   "/notifications/:id/read",
//   verifyToken,
//   allowRoles("DOCTOR"),
//   doctorController.markDoctorNotificationRead
// );

router.put(
  "/notifications/:id/unread",
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.getDoctorUnreadCount
);

router.get(
  "/reviews",
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.getDoctorReviews
);

router.post(
  "/appointments/:id/summary",
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.addVisitSummary
);

router.get(
  "/my-qr",
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.getMyQR
);

router.post(
  "/manualbooking",
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.manualVisitBooking
);



module.exports = router;
