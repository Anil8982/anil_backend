const { verifyToken } = require("../middleware/auth");
const upload = require("../middleware/upload.middleware");
const authController = require("../controllers/authController");
const express = require("express");

const router = express.Router();

router.post("/login", authController.login);
router.post("/forgot-password", authController.forgotPassword);
router.post("/verify-reset", authController.verifyReset);
router.post("/reset-password", authController.resetPassword);

// ✅ PROFILE IMAGE UPLOAD
router.post(
  "/upload-profile-image",
  verifyToken, 
  upload.single("image"), 
  authController.uploadProfileImage,
);

router.get(
  "/getprofile-image",
  verifyToken,  
  authController.getProfileImage,
);


router.delete(
  "/deleteprofile-image",
  verifyToken,
  authController.deleteProfileImage
);


router.put(
  "/updateprofile-image",
  verifyToken,
  upload.single("image"),
  authController.updateProfileImage
);


module.exports = router;
