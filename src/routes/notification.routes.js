const router = require("express").Router();
const { verifyToken } = require("../middleware/auth");
const notificationController = require("../controllers/notificationController");

router.get(
  "/my-notifications",
  verifyToken,
  notificationController.getMyNotifications
);

module.exports = router;
