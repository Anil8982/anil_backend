const express = require("express");
const router = express.Router();
const patientController = require("../controllers/patientController");
const staffController = require("../controllers/staffController");
const authController = require("../controllers/authController");
const { verifyToken } = require("../middleware/auth");
const { allowRoles } = require("../middleware/roles");
const { requireActiveUser } = require("../middleware/activeUser");

// Auth
router.post("/register", patientController.register);
router.post("/login", authController.login);

// Profile
router.get("/getprofile", verifyToken, patientController.getProfile);
router.put("/updateProfile", verifyToken, patientController.updateProfile);
router.put("/change-password", verifyToken, patientController.changePassword);

// Dashboard
router.get(
  "/dashboard",
  verifyToken,
  requireActiveUser,
  allowRoles("PATIENT"),
  patientController.getDashboard
);

// Search & filters
router.get("/visit/doctors", verifyToken, patientController.searchVisitDoctors);
router.get("/cities", patientController.getCities);
router.get("/diseases", patientController.getDiseases);
router.get("/clinicname", patientController.getPlaceNames);
router.get("/doctorname", patientController.getDoctorNames);

// Booking
router.post(
  "/visit/appointments",
  verifyToken,
  patientController.bookVisitAppointment
);
router.get(
  "/getclinicvisit/appointments",
  verifyToken,
  patientController.getClinicAppointments
);
router.put(
  "/visit/appointments/:id/cancel",
  verifyToken,
  patientController.cancelAppointment
);
router.get(
  "/visit/appointments/history",
  verifyToken,
  patientController.getVisitAppointmentHistory
);

router.post("/visit/qr-book", verifyToken, patientController.qrBookVisit);
router.get(
  "/visit/token-status/:appointmentId",
  verifyToken,
  patientController.getTokenStatus
);

router.get(
  "/appointments/upcoming",
  verifyToken,
  patientController.getUpcomingAppointments
);



// Staff manual booking
// router.post(
//   "/visit/manual-book",
//   verifyToken,
//   allowRoles("STAFF", "NURSE"),
//   staffController.manualVisitBooking
// );


router.post(
  "/doctor-feedback",
  verifyToken,
  allowRoles("PATIENT"),
  patientController.submitDoctorReview
);

// Notifications
router.get(
  "/notifications",
  verifyToken,
  patientController.getPatientNotifications
);
router.put(
  "/notifications/:id/read",
  verifyToken,
  patientController.markNotificationRead
);

// Family
router.post("/addfamily", verifyToken, patientController.addFamilyMember);
router.get("/getfamily", verifyToken, patientController.getFamilyMembers);
router.put(
  "/updatefamily/:id",
  verifyToken,
  patientController.updateFamilyMember
);
router.delete(
  "/deletefamily/:id",
  verifyToken,
  patientController.deleteFamilyMember
);

router.get(
  "/appointments/:id/summary",
  verifyToken,
  allowRoles("PATIENT"),
  patientController.getVisitSummary
);

module.exports = router;
