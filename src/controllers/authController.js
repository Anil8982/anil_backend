
//   const { mobile, password } = req.body;

//   if (!mobile || !password) {
//     return res.status(400).json({
//       message: "Mobile number & password required",
//     });
//   }

//   // Basic mobile validation (India example – adjust if needed)
//   const mobileRegex = /^[6-9]\d{9}$/;
//   if (!mobileRegex.test(mobile)) {
//     return res.status(400).json({
//       message: "Invalid mobile number format",
//     });
//   }

//   try {
//     const [users] = await db.query(
//       `SELECT id, mobile, password, role, is_active
//        FROM users
//        WHERE mobile = ?`,
//       [mobile]
//     );

//     if (users.length === 0) {
//       return res.status(401).json({
//         message: "Invalid mobile number or password",
//       });
//     }

//     const user = users[0];

//     if (user.is_active === 0) {
//       return res.status(403).json({
//         message: "Account is inactive. Please contact support",
//       });
//     }

//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch) {
//       return res.status(401).json({
//         message: "Invalid mobile number or password",
//       });
//     }

//     // ✅ JWT
//     const token = jwt.sign(
//       { id: user.id, role: user.role },
//       process.env.JWT_SECRET,
//       { expiresIn: "1d" }
//     );

//     return res.status(200).json({
//       message: "Login successful",
//       token,
//       user: {
//         id: user.id,
//         mobile: user.mobile,
//         role: user.role,
//       },
//     });
//   } catch (err) {
//     return res.status(500).json({
//       message: "Server error",
//       error: err.message,
//     });
//   }
// };

// controllers/authController.js
const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

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
      [identifier, identifier]
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
        [user.id]
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
      { expiresIn: "1d" }
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
