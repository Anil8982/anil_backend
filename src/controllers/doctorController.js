const db = require("../config/db");
const bcrypt = require("bcryptjs");

exports.register = async (req, res) => {
  const {
    doctorName,
    degree,
    licenseNumber,
    specialization,
    clinicName,
    city,
    address,
    consultationFee,
    timings,
    availableDays,
    email,
    password,
    confirmPassword,
  } = req.body;

  // --------------------
  // Basic required fields check
  // --------------------
  if (
    !doctorName ||
    !email ||
    !password ||
    !confirmPassword ||
    !licenseNumber ||
    !specialization
  ) {
    return res.status(400).json({ message: "Required fields missing" });
  }

  // --------------------
  // Email validation
  // --------------------
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: "Invalid email format" });
  }

  // --------------------
  // Password checks
  // --------------------
  if (password !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  if (password.length < 8) {
    return res.status(400).json({
      message: "Password must be at least 8 characters long",
    });
  }

  // --------------------
  // availableDays validation
  // --------------------
  if (!Array.isArray(availableDays)) {
    return res.status(400).json({
      message: "availableDays must be an array",
    });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // --------------------
    // Check if email already exists
    // --------------------
    const [existingUser] = await connection.query(
      "SELECT id FROM users WHERE loginId = ?",
      [email]
    );

    if (existingUser.length > 0) {
      await connection.rollback();
      connection.release();
      return res.status(409).json({ message: "Doctor already exists" });
    }

    // --------------------
    // Check if license number already exists
    // --------------------
    const [licenseCheck] = await connection.query(
      "SELECT id FROM doctors WHERE licenseNumber = ?",
      [licenseNumber]
    );

    if (licenseCheck.length > 0) {
      await connection.rollback();
      connection.release();
      return res
        .status(409)
        .json({ message: "License number already registered" });
    }

    // --------------------
    // Hash password
    // --------------------
    const hashedPassword = await bcrypt.hash(password, 10);

    // --------------------
    // Insert into users table
    // --------------------
    const [userResult] = await connection.query(
      "INSERT INTO users (loginId, password, role) VALUES (?, ?, 'DOCTOR')",
      [email, hashedPassword]
    );

    const userId = userResult.insertId;

    // --------------------
    // Insert into doctors table (status = PENDING)
    // --------------------
    await connection.query(
      `INSERT INTO doctors
       (user_id, doctorName, degree, licenseNumber, specialization,email,
        clinicName, city, address, consultationFee, timings, availableDays, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)`,
      [
        userId,
        doctorName,
        degree,
        licenseNumber,
        specialization,
        clinicName,
        email,
        city,
        address,
        consultationFee,
        timings,
        JSON.stringify(availableDays),
        "PENDING",
      ]
    );

    // --------------------
    // Commit transaction
    // --------------------
    await connection.commit();
    connection.release();

    return res.status(201).json({
      message: "Doctor registered successfully. Waiting for admin approval.",
    });
  } catch (err) {
    await connection.rollback();
    connection.release();
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};
