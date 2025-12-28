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
  "/doctors/:id/approve",
  verifyToken,
  requireActiveUser,
  allowRoles("ADMIN"),
  adminController.approveDoctor
);

router.put(
  "/doctors/:id/reject",
  verifyToken,
  requireActiveUser,
  allowRoles("ADMIN"),
  adminController.rejectDoctor
);

module.exports = router;
