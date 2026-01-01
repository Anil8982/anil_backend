const express = require("express");
const router = express.Router();
const patientController = require("../controllers/patientController");
const staffController = require("../controllers/staffController");
const authController = require("../controllers/authController");
const { verifyToken } = require("../middleware/auth");
const { allowRoles } = require("../middleware/roles");
const { requireActiveUser } = require("../middleware/activeUser"); 

// Public routes
router.post("/register", patientController.register);
router.post("/login", authController.login);

// Protected routes
router.get("/profile", verifyToken, patientController.getProfile);
router.put("/updateProfile", verifyToken, patientController.updateProfile);
router.put("/change-password", verifyToken, patientController.changePassword);


// dashboard routes

router.get(
  "/dashboard",
  verifyToken,
  requireActiveUser,
  allowRoles("PATIENT"),
  patientController.getDashboard
);





// video consultation

router.get("/video/doctors", verifyToken, patientController.searchVideoDoctors);

router.post(
  "/video/appointments",
  verifyToken,
  patientController.bookVideoAppointment
);
router.get(
  "/video/appointments",
  verifyToken,
  patientController.getVideoAppointments
);
router.put(
  "/video/appointments/:id/cancel",
  verifyToken,
  patientController.cancelVideoAppointment
);
router.put(
  "/video/appointments/:id/reschedule",
  verifyToken,
  patientController.rescheduleVideoAppointment
);

// PATIENT CLINIC / HOSPITAL BOOKING

router.post("/visit/appointments",verifyToken,patientController.bookVisitAppointment);
router.get("/visit/doctors", verifyToken, patientController.searchVisitDoctors);
router.get("/cities", patientController.getCities);
router.get("/diseases", patientController.getDiseases);

router.get("/visit/appointments",verifyToken,patientController.getClinicAppointments);
router.put("/visit/appointments/:id/cancel",verifyToken,patientController.cancelClinicAppointment);
router.get(
  "/visit/appointments/history",
  verifyToken,
  patientController.getVisitAppointmentHistory
);

router.post(
  "/visit/qr-book",
  verifyToken,
  patientController.qrBookVisit
);
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




router.get(
  "/notifications",
  verifyToken,
  patientController.getPatientNotifications
);

router.get(
  "/notifications/:id/read",
  verifyToken,
  patientController.markNotificationRead 
);



router.get(
  "/appointments/:id",
  verifyToken,
  patientController.getAppointmentDetail
);

router.put(
  "/appointments/:id/hard-cancel",
  verifyToken,
  patientController.hardCancelAppointment
);


router.post(
  "/visit/manual-book",
  verifyToken,         
  staffController.manualVisitBooking
);

router.post(
  "/addfamily",
  verifyToken,
  patientController.addFamilyMember
);

router.get(
  "/getfamily",
  verifyToken,
  patientController.getFamilyMembers
);

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

//

module.exports = router;
