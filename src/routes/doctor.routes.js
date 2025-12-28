const express = require("express");
const router = express.Router();
const doctorController = require("../controllers/doctorController");
const authController = require("../controllers/authController");
const { verifyToken } = require("../middleware/auth");
const { allowRoles } = require("../middleware/roles");
const { requireActiveUser } = require("../middleware/activeUser");

router.post("/register", doctorController.register);
router.post("/login", authController.login);

router.get(
  "/dashboard",
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.getDashboard
);

router.get(
  "/appointments/incoming",
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.getIncomingAppointments
);

router.put(
  "/appointments/:id/respond",
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

router.get(
  "/notifications",
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.getDoctorNotifications
);


router.post(
  "/appointments/next-token",
  verifyToken,
  requireActiveUser,
  allowRoles("DOCTOR"),
  doctorController.callNextToken
);

module.exports = router;
