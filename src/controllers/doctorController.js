const db = require("../config/db");
const bcrypt = require("bcryptjs");
const createNotification = require("../../utils/patientNotification");

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
   (user_id, doctorName, degree, licenseNumber, specialization, email,
    clinicName, city, address, consultationFee, timings, availableDays, status)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        doctorName,
        degree,
        licenseNumber,
        specialization,
        email, // ✅ email goes here
        clinicName, // ✅ clinicName goes here
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


// doctor  respondAppointment

exports.respondAppointment = async (req, res) => {
  const doctorId = req.user.id;
  const { id } = req.params;
  const { action } = req.body;

  const status = action === "ACCEPT" ? "ACCEPTED" : "REJECTED";

  try {
    const [[appointment]] = await db.query(
      `SELECT patient_id FROM appointments WHERE id = ?`,
      [id]
    );

    await db.query(
      `UPDATE appointments
       SET status = ?
       WHERE id = ? AND doctor_id = ?`,
      [status, id, doctorId]
    );

    // 🔔 Notify patient
    await createNotification({
      receiverId: appointment.patient_id,
      receiverRole: "PATIENT",
      title: `Appointment ${status}`,
      message: `Your appointment has been ${status.toLowerCase()}.`,
      appointmentId: id,
    });

    res.json({ message: `Appointment ${status}` });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.getDashboard = async (req, res) => {
  const doctorId = req.user.id;

  try {
    const [[pending]] = await db.query(
      `SELECT COUNT(*) AS count
       FROM appointments
       WHERE doctor_id = ?
       AND status = 'PENDING'`,
      [doctorId]
    );

    const [[todayTotal]] = await db.query(
      `SELECT COUNT(*) AS count
       FROM appointments
       WHERE doctor_id = ?
       AND appointment_date = CURDATE()
       AND appointment_type IN ('CLINIC','HOSPITAL')`,
      [doctorId]
    );

    const [[todayCompleted]] = await db.query(
      `SELECT COUNT(*) AS count
       FROM appointments
       WHERE doctor_id = ?
       AND appointment_date = CURDATE()
       AND status = 'COMPLETED'`,
      [doctorId]
    );

    res.json({
      pendingRequests: pending.count,
      todayQueue: todayTotal.count,
      completedToday: todayCompleted.count,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.getIncomingAppointments = async (req, res) => {
  const doctorId = req.user.id;

  try {
    const [appointments] = await db.query(
      `SELECT
        a.id,
        a.appointment_type,
        a.appointment_date,
        a.appointment_time,
        a.token_number,
        a.status,
        a.created_by,

        u.loginId AS patientEmail,
        fm.full_name AS familyMemberName

       FROM appointments a
       LEFT JOIN users u ON a.patient_id = u.id
       LEFT JOIN family_members fm ON a.family_member_id = fm.id
       WHERE a.doctor_id = ?
       AND a.status = 'PENDING'
       ORDER BY a.appointment_date, a.token_number`,
      [doctorId]
    );

    res.json({ appointments });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.respondAppointment = async (req, res) => {
  const doctorId = req.user.id;
  const { id } = req.params;
  const { action } = req.body;

  if (!["ACCEPT", "REJECT"].includes(action)) {
    return res.status(400).json({ message: "Invalid action" });
  }

  const status = action === "ACCEPT" ? "ACCEPTED" : "REJECTED";

  try {
    const [[appt]] = await db.query(
      `SELECT patient_id FROM appointments WHERE id = ?`,
      [id]
    );

    const [result] = await db.query(
      `UPDATE appointments
       SET status = ?
       WHERE id = ?
       AND doctor_id = ?
       AND status = 'PENDING'`,
      [status, id, doctorId]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ message: "Action not allowed" });
    }

    // 🔔 notify patient
    await createNotification({
      receiverId: appt.patient_id,
      receiverRole: "PATIENT",
      title: `Appointment ${status}`,
      message: `Doctor has ${status.toLowerCase()} your appointment`,
      appointmentId: id,
    });

    res.json({ message: `Appointment ${status}` });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.getTodayQueue = async (req, res) => {
  const doctorId = req.user.id;

  try {
    const [queue] = await db.query(
      `SELECT
        a.id,
        a.token_number,
        a.status,
        u.loginId AS patientEmail,
        fm.full_name AS familyMemberName
       FROM appointments a
       LEFT JOIN users u ON a.patient_id = u.id
       LEFT JOIN family_members fm ON a.family_member_id = fm.id
       WHERE a.doctor_id = ?
       AND a.appointment_date = CURDATE()
       AND a.appointment_type IN ('CLINIC','HOSPITAL')
       AND a.status IN ('ACCEPTED','IN_PROGRESS')
       ORDER BY a.token_number`,
      [doctorId]
    );

    res.json({ queue });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.startAppointment = async (req, res) => {
  const doctorId = req.user.id;
  const { id } = req.params;

  try {
    await db.query(
      `UPDATE appointments
       SET status = 'IN_PROGRESS'
       WHERE id = ?
       AND doctor_id = ?
       AND status = 'ACCEPTED'`,
      [id, doctorId]
    );

    res.json({ message: "Appointment started" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.completeAppointment = async (req, res) => {
  const doctorId = req.user.id;
  const { id } = req.params;

  try {
    await db.query(
      `UPDATE appointments
       SET status = 'COMPLETED'
       WHERE id = ?
       AND doctor_id = ?
       AND status = 'IN_PROGRESS'`,
      [id, doctorId]
    );

    // 🔔 notify patient
    const [[appt]] = await db.query(
      `SELECT patient_id FROM appointments WHERE id = ?`,
      [id]
    );

    await createNotification({
      receiverId: appt.patient_id,
      receiverRole: "PATIENT",
      title: "Appointment Completed",
      message: "Your appointment has been completed",
      appointmentId: id,
    });

    res.json({ message: "Appointment completed" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.getDoctorNotifications = async (req, res) => {
  const doctorId = req.user.id;

  try {
    const [notifications] = await db.query(
      `SELECT id, title, message, appointment_id, is_read, created_at
       FROM notifications
       WHERE receiver_id = ?
       AND receiver_role = 'DOCTOR'
       ORDER BY created_at DESC`,
      [doctorId]
    );

    res.json({ notifications });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.callNextToken = async (req, res) => {
  const doctorId = req.user.id;

  try {
    // 1️⃣ Complete current IN_PROGRESS
    await db.query(
      `UPDATE appointments
       SET status = 'COMPLETED'
       WHERE doctor_id = ?
       AND appointment_date = CURDATE()
       AND appointment_type IN ('CLINIC','HOSPITAL')
       AND status = 'IN_PROGRESS'`,
      [doctorId]
    );

    // 2️⃣ Get next ACCEPTED token
    const [[next]] = await db.query(
      `SELECT id, patient_id, token_number
       FROM appointments
       WHERE doctor_id = ?
       AND appointment_date = CURDATE()
       AND appointment_type IN ('CLINIC','HOSPITAL')
       AND status = 'ACCEPTED'
       ORDER BY token_number ASC
       LIMIT 1`,
      [doctorId]
    );

    if (!next) {
      return res.json({ message: "No more tokens in queue" });
    }

    // 3️⃣ Mark IN_PROGRESS
    await db.query(
      `UPDATE appointments
       SET status = 'IN_PROGRESS'
       WHERE id = ?`,
      [next.id]
    );

    // 🔔 Notify patient
    await createNotification({
      receiverId: next.patient_id,
      receiverRole: "PATIENT",
      title: "Your Turn Now",
      message: `Token ${next.token_number} is now being served`,
      appointmentId: next.id,
    });

    res.json({
      message: "Next token called",
      token: next.token_number,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
