const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");

const { verifyToken } = require("../middleware/auth");
const { allowRoles } = require("../middleware/roles");
const { requireActiveUser } = require("../middleware/activeUser");

router.get(
  "/dashboard",
  verifyToken,
  requireActiveUser,
  allowRoles("ADMIN"),
  adminController.getDashboard
);

router.get(
  "/doctors",
  verifyToken,
  requireActiveUser,
  allowRoles("ADMIN"),
  adminController.getDoctors
);

router.put(
  "/doctor/approve/:id",
  verifyToken,
  allowRoles("ADMIN"),
  adminController.approveDoctor
);

router.put(
  "/doctor/reject/:id",
  verifyToken,
  allowRoles("ADMIN"),
  adminController.rejectDoctor
);


// Patient management


router.get(
  "/patients",
  verifyToken,
  requireActiveUser,
  allowRoles("ADMIN"),
  adminController.getPatients
);

router.put(
  "/users/:id/block",
  verifyToken,
  requireActiveUser,
  allowRoles("ADMIN"),
  adminController.blockUser
);

router.put(
  "/users/:id/unblock",
  verifyToken,
  requireActiveUser,
  allowRoles("ADMIN"),
  adminController.unblockUser
);

// Appointments (Admin power)

router.get(
  "/appointments",
  verifyToken,
  requireActiveUser,
  allowRoles("ADMIN"),
  adminController.getAllAppointments
);

router.put(
  "/appointments/:id/cancel",
  verifyToken,
  requireActiveUser,
  allowRoles("ADMIN"),
  adminController.forceCancelAppointment
);


// analytics

router.get(
  "/analytics",
  verifyToken,
  requireActiveUser,
  allowRoles("ADMIN"),
  adminController.getAdminAnalytics
);



module.exports = router;
