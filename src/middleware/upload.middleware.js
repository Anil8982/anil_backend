const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      if (!req.user || !req.user.role) {
        return cb(new Error("Unauthorized upload"), null);
      }

      const role = req.user.role.toLowerCase(); // doctor | patient
      const uploadPath = path.join("uploads", "profiles", `${role}s`);

      fs.mkdirSync(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (err) {
      cb(err, null);
    }
  },

  filename: (req, file, cb) => {
    const safeExt = path.extname(file.originalname).toLowerCase();
    const allowedExts = [".jpg", ".jpeg", ".png", ".webp"];

    if (!allowedExts.includes(safeExt)) {
      return cb(new Error("Invalid image format"), null);
    }

    const uniqueName = `user_${req.user.id}_${Date.now()}${safeExt}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith("image/")) {
    return cb(new Error("Only image files allowed"), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
  },
});

module.exports = upload;
