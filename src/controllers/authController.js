const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const { sendEmail } = require("../utils/email.service");
const resetPasswordTemplate = require("../utils/emailTemplates/resetPassword.template");

// common login api for doctor and patients

exports.login = async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({
      message: "Email or mobile and password required",
    });
  }

  try {
    // --------------------
    // Find user by email OR mobile
    // --------------------
    const [users] = await db.query(
      `SELECT id, email, mobile, password, role, is_active
       FROM users
       WHERE email = ? OR mobile = ?`,
      [identifier, identifier],
    );

    if (users.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = users[0];

    if (user.is_active === 0) {
      return res.status(403).json({ message: "Account inactive" });
    }

    // --------------------
    // Password check
    // --------------------
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // --------------------
    // 🔥 DOCTOR APPROVAL CHECK
    // --------------------
    if (user.role === "DOCTOR") {
      const [[doctor]] = await db.query(
        `SELECT status FROM doctors WHERE user_id = ?`,
        [user.id],
      );

      if (!doctor) {
        return res.status(403).json({
          message: "Doctor profile not found. Contact admin.",
        });
      }

      if (doctor.status !== "APPROVED") {
        return res.status(403).json({
          message: "Your account is pending approval. Please contact admin.",
        });
      }
    }

    // --------------------
    // Generate JWT
    // --------------------
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
      },
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// forget password through email or mobile number

exports.forgotPassword = async (req, res) => {
  const { identifier } = req.body; // email only

  if (!identifier) {
    return res.status(400).json({ message: "Email is required" });
  }

  // 1️⃣ Find user by email
  const [[user]] = await db.query(
    `SELECT id, email FROM users WHERE email = ?`,
    [identifier],
  );

  // Security: do not reveal whether email exists
  if (!user) {
    return res.json({
      message: "If the email exists, a reset link has been sent",
    });
  }

  // 2️⃣ Generate plain reset token
  const plainToken = crypto.randomBytes(32).toString("hex");

  // 3️⃣ Hash token before storing (security)
  const hashedToken = crypto
    .createHash("sha256")
    .update(plainToken)
    .digest("hex");

  // 4️⃣ Save hashed token + expiry
  await db.query(
    `UPDATE users
     SET reset_token = ?, reset_token_expiry = DATE_ADD(NOW(), INTERVAL 15 MINUTE)
     WHERE id = ?`,
    [hashedToken, user.id],
  );

  // 5️⃣ Create reset link (frontend page)
  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${plainToken}`;

  // 6️⃣ Send reset password email (HTML)
  await sendEmail({
    to: user.email,
    subject: "Reset Your YoDoctor Password",
    html: resetPasswordTemplate(resetLink),
  });

  res.json({
    message: "If the email exists, a reset link has been sent",
  });
};

// VERIFY TOKEN for email /  verofy OTP for mobile number

exports.verifyReset = async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ message: "Token required" });
  }

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const [[user]] = await db.query(
    `SELECT id
     FROM users
     WHERE reset_token = ?
     AND reset_token_expiry > NOW()`,
    [hashedToken],
  );

  if (!user) {
    return res.status(400).json({ message: "Invalid or expired link" });
  }

  res.json({ message: "Token valid" });
};

// RESET PASSWORD (FINAL STEP)

exports.resetPassword = async (req, res) => {
  const { token, newPassword, confirmPassword } = req.body;

  if (!token || !newPassword || !confirmPassword) {
    return res.status(400).json({ message: "All fields required" });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: "Password too short" });
  }

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  const [result] = await db.query(
    `UPDATE users
     SET password = ?, reset_token = NULL, reset_token_expiry = NULL
     WHERE reset_token = ?
     AND reset_token_expiry > NOW()`,
    [hashedPassword, hashedToken],
  );

  if (result.affectedRows === 0) {
    return res.status(400).json({ message: "Invalid or expired link" });
  }

  res.json({ message: "Password reset successfully" });
};
