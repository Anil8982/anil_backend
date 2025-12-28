const db = require("../config/db");
const bcrypt = require("bcryptjs");

// --------------------
// Patient Registration
// --------------------
exports.register = async (req, res) => {
  const { fullName, phone, email, password, confirmPassword, gender, dob } =
    req.body;

  if (
    !fullName ||
    !phone ||
    !email ||
    !password ||
    !confirmPassword ||
    !gender ||
    !dob
  ) {
    return res.status(400).json({ message: "All fields are required" });
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: "Invalid email format" });
  }

  // Phone validation (India)
  if (!/^\d{10}$/.test(phone)) {
    return res.status(400).json({ message: "Invalid phone number" });
  }

  // Password checks
  if (password !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  if (password.length < 8) {
    return res
      .status(400)
      .json({ message: "Password must be at least 8 characters" });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Check existing user
    const [existingUser] = await connection.query(
      "SELECT id FROM users WHERE loginId = ?",
      [email]
    );

    if (existingUser.length > 0) {
      await connection.rollback();
      connection.release();
      return res.status(409).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [userResult] = await connection.query(
      "INSERT INTO users (loginId, password, role) VALUES (?, ?, 'PATIENT')",
      [email, hashedPassword]
    );

    await connection.query(
      `INSERT INTO patients (user_id, fullName, phone, gender, dob,email)
       VALUES (?, ?, ?, ?, ?,?)`,
      [userResult.insertId, fullName, phone, gender, dob, email]
    );

    await connection.commit();
    connection.release();

    return res.status(201).json({ message: "Patient registered successfully" });
  } catch (err) {
    await connection.rollback();
    connection.release();
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};
// Patient getDashboard

exports.getDashboard = async (req, res) => {
  const patientId = req.user.id;

  try {
    // -------------------------------
    // 1️⃣ Upcoming appointments count
    // -------------------------------
    const [[upcoming]] = await db.query(
      `SELECT COUNT(*) AS count
       FROM appointments
       WHERE patient_id = ?
       AND appointment_date >= CURDATE()
       AND status IN ('PENDING','ACCEPTED')`,
      [patientId]
    );

    // -------------------------------
    // 2️⃣ Today's clinic / hospital token
    // -------------------------------
    const [[todayToken]] = await db.query(
      `SELECT 
         appointment_type,
         token_number
       FROM appointments
       WHERE patient_id = ?
       AND appointment_date = CURDATE()
       AND appointment_type IN ('CLINIC','HOSPITAL')
       AND status IN ('PENDING','ACCEPTED')
       ORDER BY token_number ASC
       LIMIT 1`,
      [patientId]
    );

    // -------------------------------
    // 3️⃣ Pending / Accepted list
    // -------------------------------
    const [appointments] = await db.query(
      `SELECT
        a.id,
        d.doctorName,
        d.specialization,
        a.appointment_type,
        a.appointment_date,
        a.appointment_time,
        a.token_number,
        a.status
       FROM appointments a
       JOIN doctors d ON a.doctor_id = d.user_id
       WHERE a.patient_id = ?
       AND a.status IN ('PENDING','ACCEPTED')
       ORDER BY a.appointment_date ASC, a.token_number ASC`,
      [patientId]
    );

    return res.status(200).json({
      upcomingCount: upcoming.count,
      todayToken: todayToken
        ? {
            type: todayToken.appointment_type,
            token: todayToken.token_number,
          }
        : null,
      appointments,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// --------------------
// Get Patient Profile (FIXED)
// --------------------
exports.getProfile = async (req, res) => {
  const userId = req.user.id;

  try {
    const [rows] = await db.query(
      `SELECT 
        p.id,
        p.fullName,
        p.phone,
        u.loginId AS email,
        p.gender,
        p.dob
       FROM patients p
       JOIN users u ON p.user_id = u.id
       WHERE p.user_id = ?`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Patient not found" });
    }

    return res.status(200).json(rows[0]);
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

// --------------------
// Update Patient Profile
// --------------------
exports.updateProfile = async (req, res) => {
  const userId = req.user.id;
  const { fullName, phone, gender, dob } = req.body;

  const fields = [];
  const values = [];

  if (fullName) {
    fields.push("fullName = ?");
    values.push(fullName);
  }

  if (phone) {
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ message: "Invalid phone number" });
    }
    fields.push("phone = ?");
    values.push(phone);
  }

  if (gender) {
    fields.push("gender = ?");
    values.push(gender);
  }

  if (dob) {
    fields.push("dob = ?");
    values.push(dob);
  }

  if (fields.length === 0) {
    return res.status(400).json({ message: "No fields provided to update" });
  }

  values.push(userId);

  try {
    const [result] = await db.query(
      `UPDATE patients SET ${fields.join(", ")} WHERE user_id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Patient not found" });
    }

    return res.status(200).json({ message: "Profile updated successfully" });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

// Update changePassword

exports.changePassword = async (req, res) => {
  try {
    const patientId = req.user.id; // ✅ FIXED HERE

    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    // 🔍 Get current password
    const [user] = await db.query("SELECT password FROM users WHERE id = ?", [
      patientId,
    ]);

    if (user.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    // 🔐 Compare current password
    const isMatch = await bcrypt.compare(currentPassword, user[0].password);

    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // 🔒 Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.query("UPDATE users SET password = ? WHERE id = ?", [
      hashedPassword,
      patientId,
    ]);

    return res.status(200).json({
      message: "Password changed successfully",
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// --------------------
// searchVideoDoctors

exports.searchVideoDoctors = async (req, res) => {
  const search = req.query.search || "";
  const city = req.query.city || "";

  try {
    const [doctors] = await db.query(
      `SELECT 
        d.user_id AS doctorId,
        d.doctorName,
        d.specialization,
        d.city,
        d.consultationFee
       FROM doctors d
       WHERE d.status = 'APPROVED'
       AND (
         d.specialization LIKE ?
         OR d.doctorName LIKE ?
       )
       AND d.city LIKE ?`,
      [`%${search}%`, `%${search}%`, `%${city}%`]
    );

    return res.status(200).json({ doctors });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

exports.bookVideoAppointment = async (req, res) => {
  const patientId = req.user.id;
  const { doctorId, appointmentDate, appointmentTime } = req.body;

  if (!doctorId || !appointmentDate || !appointmentTime) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    // Prevent double booking
    const [existing] = await db.query(
      `SELECT id FROM appointments
       WHERE doctor_id = ?
       AND appointment_date = ?
       AND appointment_time = ?
       AND appointment_type = 'VIDEO'
       AND status != 'CANCELLED'`,
      [doctorId, appointmentDate, appointmentTime]
    );

    if (existing.length > 0) {
      return res.status(409).json({ message: "Slot already booked" });
    }

    await db.query(
      `INSERT INTO appointments
   (appointment_type, patient_id, family_member_id, doctor_id,
    appointment_date, token_number, status, created_by)
   VALUES (?, ?, ?, ?, CURDATE(), ?, 'PENDING', 'PATIENT')`,
      [appointmentType, patientId, familyMemberId, doctorId, tokenNumber]
    );

    return res.status(201).json({
      message: "Video appointment booked",
      status: "PENDING",
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getVideoAppointments = async (req, res) => {
  const patientId = req.user.id;

  try {
    const [appointments] = await db.query(
      `SELECT 
        a.id,
        d.doctorName,
        d.specialization,
        a.appointment_date,
        a.appointment_time,
        a.status
       FROM appointments a
       JOIN doctors d ON a.doctor_id = d.user_id
       WHERE a.patient_id = ?
       AND a.appointment_type = 'VIDEO'
       ORDER BY a.appointment_date DESC`,
      [patientId]
    );

    return res.status(200).json({ appointments });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

exports.cancelVideoAppointment = async (req, res) => {
  const patientId = req.user.id;
  const appointmentId = req.params.id;

  try {
    const [result] = await db.query(
      `UPDATE appointments
       SET status = 'CANCELLED'
       WHERE id = ?
       AND patient_id = ?
       AND appointment_type = 'VIDEO'
       AND status IN ('PENDING','ACCEPTED')`,
      [appointmentId, patientId]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ message: "Cannot cancel appointment" });
    }

    return res.status(200).json({
      message: "Video appointment cancelled",
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

exports.rescheduleVideoAppointment = async (req, res) => {
  const patientId = req.user.id;
  const appointmentId = req.params.id;
  const { appointmentDate, appointmentTime } = req.body;

  // --------------------
  // Validation
  // --------------------
  if (!appointmentDate || !appointmentTime) {
    return res.status(400).json({
      message: "appointmentDate and appointmentTime are required",
    });
  }

  try {
    // --------------------
    // Check appointment ownership + type + status
    // --------------------
    const [appointments] = await db.query(
      `SELECT doctor_id, status
       FROM appointments
       WHERE id = ?
       AND patient_id = ?
       AND appointment_type = 'VIDEO'`,
      [appointmentId, patientId]
    );

    if (appointments.length === 0) {
      return res.status(404).json({
        message: "Video appointment not found",
      });
    }

    if (!["PENDING", "ACCEPTED"].includes(appointments[0].status)) {
      return res.status(400).json({
        message: "Appointment cannot be rescheduled",
      });
    }

    const doctorId = appointments[0].doctor_id;

    // --------------------
    // Prevent double booking
    // --------------------
    const [existing] = await db.query(
      `SELECT id
       FROM appointments
       WHERE doctor_id = ?
       AND appointment_date = ?
       AND appointment_time = ?
       AND appointment_type = 'VIDEO'
       AND status != 'CANCELLED'
       AND id != ?`,
      [doctorId, appointmentDate, appointmentTime, appointmentId]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        message: "Selected slot is already booked",
      });
    }

    // --------------------
    // Update appointment
    // --------------------
    await db.query(
      `UPDATE appointments
       SET appointment_date = ?, appointment_time = ?
       WHERE id = ?`,
      [appointmentDate, appointmentTime, appointmentId]
    );

    return res.status(200).json({
      message: "Video appointment rescheduled successfully",
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// PATIENT CLINIC / HOSPITAL BOOKING

exports.bookVisitAppointment = async (req, res) => {
  const patientId = req.user.id;
  const { doctorId, appointmentType } = req.body;

  if (!doctorId || appointmentType !== "CLINIC") {
    return res.status(400).json({ message: "Invalid request" });
  }

  try {
    // 🔢 Token generation
    const [[row]] = await db.query(
      `SELECT MAX(token_number) AS lastToken
       FROM appointments
       WHERE doctor_id = ?
       AND appointment_date = CURDATE()
       AND appointment_type = 'CLINIC'`,
      [doctorId]
    );

    const nextToken = (row.lastToken || 0) + 1;

    await db.query(
      `INSERT INTO appointments
   (appointment_type, patient_id, family_member_id, doctor_id,
    appointment_date, token_number, status, created_by)
   VALUES (?, ?, ?, ?, CURDATE(), ?, 'PENDING', 'PATIENT')`,
      [appointmentType, patientId, familyMemberId, doctorId, tokenNumber]
    );

    res.status(201).json({
      message: "Clinic appointment booked",
      token: nextToken,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// PATIENT searchVisitDoctors

exports.searchVisitDoctors = async (req, res) => {
  const search = req.query.search || "";
  const city = req.query.city || "";

  try {
    const [doctors] = await db.query(
      `SELECT 
        d.user_id AS doctorId,
        d.doctorName,
        d.specialization,
        d.city
       FROM doctors d
       WHERE d.status = 'APPROVED'
       AND (
         d.doctorName LIKE ?
         OR d.specialization LIKE ?
       )
       AND d.city LIKE ?`,
      [`%${search}%`, `%${search}%`, `%${city}%`]
    );

    res.status(200).json({ doctors });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// PATIENT searchVisitDoctors

exports.getClinicAppointments = async (req, res) => {
  const patientId = req.user.id;

  try {
    const [appointments] = await db.query(
      `SELECT 
        a.id,
        d.doctorName,
        d.specialization,
        a.appointment_date,
        a.token_number,
        a.status
       FROM appointments a
       JOIN doctors d ON a.doctor_id = d.user_id
       WHERE a.patient_id = ?
       AND a.appointment_type = 'CLINIC'
       ORDER BY a.appointment_date DESC, a.token_number`,
      [patientId]
    );

    res.status(200).json({ appointments });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// PATIENT cancelClinicAppointment

exports.cancelClinicAppointment = async (req, res) => {
  const patientId = req.user.id;
  const appointmentId = req.params.id;

  try {
    const [result] = await db.query(
      `UPDATE appointments
       SET status = 'CANCELLED'
       WHERE id = ?
       AND patient_id = ?
       AND appointment_type = 'CLINIC'
       AND status IN ('PENDING','ACCEPTED')`,
      [appointmentId, patientId]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ message: "Cannot cancel appointment" });
    }

    res.status(200).json({ message: "Clinic appointment cancelled" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// PATIENT getVisitAppointmentHistory

exports.getVisitAppointmentHistory = async (req, res) => {
  const patientId = req.user.id;

  try {
    const [appointments] = await db.query(
      `SELECT
        a.id,
        d.doctorName,
        d.specialization,
        a.appointment_type,
        a.appointment_date,
        a.token_number,
        a.status,
        a.created_by
       FROM appointments a
       JOIN doctors d ON a.doctor_id = d.user_id
       WHERE a.patient_id = ?
       AND a.appointment_type IN ('CLINIC','HOSPITAL')
       ORDER BY a.appointment_date DESC, a.token_number`,
      [patientId]
    );

    return res.status(200).json({ appointments });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

// PATIENT qrBookVisit

exports.qrBookVisit = async (req, res) => {
  const patientId = req.user.id;
  const { doctorId, appointmentType } = req.body;

  try {
    const [[maxToken]] = await db.query(
      `SELECT MAX(token_number) AS token
       FROM appointments
       WHERE doctor_id = ?
       AND appointment_date = CURDATE()
       AND appointment_type = ?`,
      [doctorId, appointmentType]
    );

    const nextToken = (maxToken.token || 0) + 1;

    await db.query(
      `INSERT INTO appointments
       (appointment_type, patient_id, doctor_id,
        appointment_date, token_number, status, created_by)
       VALUES (?, ?, ?, CURDATE(), ?, 'PENDING', 'QR')`,
      [appointmentType, patientId, doctorId, nextToken]
    );

    return res.status(201).json({
      message: "QR appointment booked",
      token: nextToken,
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getTokenStatus = async (req, res) => {
  const patientId = req.user.id;
  const { appointmentId } = req.params;

  try {
    // Patient appointment
    const [[appointment]] = await db.query(
      `SELECT doctor_id, appointment_date, appointment_type, token_number
       FROM appointments
       WHERE id = ?
       AND patient_id = ?
       AND appointment_type IN ('CLINIC','HOSPITAL')`,
      [appointmentId, patientId]
    );

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    // Current serving token (lowest ACCEPTED/IN_PROGRESS)
    const [[current]] = await db.query(
      `SELECT MIN(token_number) AS currentToken
       FROM appointments
       WHERE doctor_id = ?
       AND appointment_date = ?
       AND appointment_type = ?
       AND status IN ('ACCEPTED','IN_PROGRESS')`,
      [
        appointment.doctor_id,
        appointment.appointment_date,
        appointment.appointment_type,
      ]
    );

    return res.json({
      yourToken: appointment.token_number,
      nowServing: current.currentToken || null,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.getUpcomingAppointments = async (req, res) => {
  const patientId = req.user.id;
  const filter = req.query.filter;

  let dateCondition = "a.appointment_date >= CURDATE()";
  if (filter === "today") {
    dateCondition = "a.appointment_date = CURDATE()";
  }
  if (filter === "next7") {
    dateCondition =
      "a.appointment_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)";
  }

  try {
    const [appointments] = await db.query(
      `SELECT
        a.id,
        d.doctorName,
        a.appointment_type,
        a.appointment_date,
        a.appointment_time,
        a.token_number,
        a.status
       FROM appointments a
       JOIN doctors d ON a.doctor_id = d.user_id
       WHERE a.patient_id = ?
       AND ${dateCondition}
       AND a.status IN ('PENDING','ACCEPTED')
       ORDER BY a.appointment_date, a.token_number`,
      [patientId]
    );

    res.json({ appointments });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.getPatientNotifications = async (req, res) => {
  const patientId = req.user.id;

  try {
    const [notifications] = await db.query(
      `SELECT id, title, message, appointment_id, is_read, created_at
       FROM notifications
       WHERE receiver_id = ?
       AND receiver_role = 'PATIENT'
       ORDER BY created_at DESC`,
      [patientId]
    );

    res.json({ notifications });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.markNotificationRead = async (req, res) => {
  const patientId = req.user.id;
  const { id } = req.params;

  await db.query(
    `UPDATE notifications
     SET is_read = TRUE
     WHERE id = ? AND receiver_id = ?`,
    [id, patientId]
  );

  res.json({ message: "Notification marked as read" });
};


exports.getAppointmentDetail = async (req, res) => {
  const patientId = req.user.id;
  const { id } = req.params;

  try {
    const [[appointment]] = await db.query(
      `SELECT
        a.id,
        d.doctorName,
        d.specialization,
        a.appointment_type,
        a.appointment_date,
        a.appointment_time,
        a.token_number,
        a.status,
        a.created_by
       FROM appointments a
       JOIN doctors d ON a.doctor_id = d.user_id
       WHERE a.id = ? AND a.patient_id = ?`,
      [id, patientId]
    );

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    res.json(appointment);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.hardCancelAppointment = async (req, res) => {
  const patientId = req.user.id;
  const { id } = req.params;

  try {
    const [result] = await db.query(
      `UPDATE appointments
       SET status = 'CANCELLED'
       WHERE id = ?
       AND patient_id = ?`,
      [id, patientId]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ message: "Cannot cancel appointment" });
    }

    res.json({ message: "Appointment cancelled successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.addFamilyMember = async (req, res) => {
  const patientId = req.user.id;
  const { fullName, gender, dob, bloodGroup, heightCm, weightKg, relation } =
    req.body;

  if (!fullName || !relation) {
    return res.status(400).json({
      message: "fullName and relation are required",
    });
  }

  try {
    await db.query(
      `INSERT INTO family_members
      (patient_id, full_name, gender, dob, blood_group, height_cm, weight_kg, relation)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        patientId,
        fullName,
        gender || null,
        dob || null,
        bloodGroup || null,
        heightCm || null,
        weightKg || null,
        relation,
      ]
    );

    res.status(201).json({
      message: "Family member added successfully",
    });
  } catch (err) {
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

exports.getFamilyMembers = async (req, res) => {
  const patientId = req.user.id;

  try {
    const [members] = await db.query(
      `SELECT
        id,
        full_name,
        gender,
        dob,
        TIMESTAMPDIFF(YEAR, dob, CURDATE()) AS age,
        blood_group,
        height_cm,
        weight_kg,
        relation,
        created_at
      FROM family_members
      WHERE patient_id = ?
      ORDER BY created_at DESC`,
      [patientId]
    );

    res.json({ members });
  } catch (err) {
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

exports.updateFamilyMember = async (req, res) => {
  const patientId = req.user.id;
  const { id } = req.params;

  const { fullName, gender, dob, bloodGroup, heightCm, weightKg, relation } =
    req.body;

  const fields = [];
  const values = [];

  if (fullName) {
    fields.push("full_name = ?");
    values.push(fullName);
  }
  if (gender) {
    fields.push("gender = ?");
    values.push(gender);
  }
  if (dob) {
    fields.push("dob = ?");
    values.push(dob);
  }
  if (bloodGroup) {
    fields.push("blood_group = ?");
    values.push(bloodGroup);
  }
  if (heightCm) {
    fields.push("height_cm = ?");
    values.push(heightCm);
  }
  if (weightKg) {
    fields.push("weight_kg = ?");
    values.push(weightKg);
  }
  if (relation) {
    fields.push("relation = ?");
    values.push(relation);
  }

  if (fields.length === 0) {
    return res.status(400).json({
      message: "No fields to update",
    });
  }

  values.push(id, patientId);

  try {
    const [result] = await db.query(
      `UPDATE family_members
       SET ${fields.join(", ")}
       WHERE id = ? AND patient_id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Family member not found",
      });
    }

    res.json({
      message: "Family member updated successfully",
    });
  } catch (err) {
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

exports.deleteFamilyMember = async (req, res) => {
  const patientId = req.user.id;
  const { id } = req.params;

  try {
    const [result] = await db.query(
      `DELETE FROM family_members
       WHERE id = ? AND patient_id = ?`,
      [id, patientId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Family member not found",
      });
    }

    res.json({
      message: "Family member deleted successfully",
    });
  } catch (err) {
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
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

        -- Patient info
        u.loginId AS patientEmail,

        -- Family member info
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



