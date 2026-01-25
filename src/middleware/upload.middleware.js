const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!req.user || !req.user.role) {
      return cb(new Error("Unauthorized upload"), null);
    }
    const role = req.user.role.toLowerCase(); // patient | doctor
    const uploadPath = path.join("uploads", "profiles", `${role}s`);
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = [".jpg", ".jpeg", ".png", ".webp"];
    if (!allowed.includes(ext)) {
      return cb(new Error("Invalid image format"), null);
    }
    cb(null, `user_${req.user.id}_${Date.now()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith("image/")) {
    return cb(new Error("Only image files allowed"), false);
  }
  cb(null, true);
};

module.exports = multer({
  storage,
  fileFilter,
  // limits: { fileSize: 2 * 1024 * 1024 },
  limits: { fileSize: 10 * 1024 * 1024 },
});
