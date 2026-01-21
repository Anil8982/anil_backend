const authController = require("../controllers/authController");
const express = require("express");
const router = express.Router();

router.post("/login", authController.login);

router.post("/forgot-password", authController.forgotPassword);

router.post("/verify-reset", authController.verifyReset);

router.post("/reset-password", authController.resetPassword);

module.exports = router;
