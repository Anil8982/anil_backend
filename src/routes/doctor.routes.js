const express = require("express");
const router = express.Router();
const doctorController = require("../controllers/doctorController");
const authController = require("../controllers/authController");

router.post("/register", doctorController.register);
router.post("/login", authController.login);

module.exports = router;
 