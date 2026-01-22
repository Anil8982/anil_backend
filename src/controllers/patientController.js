const db = require("../config/db");
const bcrypt = require("bcryptjs");
const eventBus = require("../events/eventBus");
const { APPOINTMENT_REQUESTED } = require("../events/notification.events");

const upload = require("../middleware/upload.middleware");

// Add Family Members helpers
const ALLOWED_RELATIONS = [
  "FATHER",
  "MOTHER",
  "SPOUSE",
  "SON",
  "DAUGHTER",
  "BROTHER",
  "SISTER",
  "OTHER",
];
// Add Family Members helpers
const isFutureDate = (date) => {
  return new Date(date) > new Date();
};

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

    // ✅ Check existing user (EMAIL OR MOBILE)
    const [existingUser] = await connection.query(
      `SELECT id FROM users WHERE email = ? OR mobile = ?`,
      [email, phone],
    );

    if (existingUser.length > 0) {
      await connection.rollback();
      connection.release();
      return res.status(409).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ INSERT INTO USERS (NO loginId)
    const [userResult] = await connection.query(
      `INSERT INTO users (email, mobile, password, role)
       VALUES (?, ?, ?, 'PATIENT')`,
      [email, phone, hashedPassword],
    );

    // ✅ INSERT INTO PATIENTS
    await connection.query(
      `INSERT INTO patients (user_id, fullName, phone, gender, dob, email)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userResult.insertId, fullName, phone, gender, dob, email],
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
        u.email,
        u.mobile,
        p.gender,
        p.dob
       FROM patients p
       JOIN users u ON p.user_id = u.id
       WHERE p.user_id = ?`,
      [userId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Patient not found" });
    }

    return res.status(200).json(rows[0]);
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// --------------------
// Update Patient Profile
// --------------------
exports.updateProfile = async (req, res) => {
  const userId = req.user.id;
  const { fullName, phone, gender, dob } = req.body;

  const patientFields = [];
  const patientValues = [];

  try {
    // -------- phone update (users + patients)
    if (phone) {
      if (!/^\d{10}$/.test(phone)) {
        return res.status(400).json({ message: "Invalid phone number" });
      }

      // check duplicate mobile
      const [existing] = await db.query(
        `SELECT id FROM users WHERE mobile = ? AND id != ?`,
        [phone, userId],
      );

      if (existing.length > 0) {
        return res.status(409).json({ message: "Mobile already in use" });
      }

      await db.query(`UPDATE users SET mobile = ? WHERE id = ?`, [
        phone,
        userId,
      ]);

      patientFields.push("phone = ?");
      patientValues.push(phone);
    }

    if (fullName) {
      patientFields.push("fullName = ?");
      patientValues.push(fullName);
    }

    if (gender) {
      patientFields.push("gender = ?");
      patientValues.push(gender);
    }

    if (dob) {
      patientFields.push("dob = ?");
      patientValues.push(dob);
    }

    if (patientFields.length === 0) {
      return res.status(400).json({ message: "No fields provided to update" });
    }

    patientValues.push(userId);

    const [result] = await db.query(
      `UPDATE patients 
       SET ${patientFields.join(", ")} 
       WHERE user_id = ?`,
      patientValues,
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Patient not found" });
    }

    return res.status(200).json({
      message: "Profile updated successfully",
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Update changePassword

exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters",
      });
    }

    const [users] = await db.query(`SELECT password FROM users WHERE id = ?`, [
      userId,
    ]);

    if (users.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, users[0].password);

    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.query(`UPDATE users SET password = ? WHERE id = ?`, [
      hashedPassword,
      userId,
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
      [patientId],
    );

    // -------------------------------
    // 2️⃣ Today's active token (with slot)
    // -------------------------------
    const [[todayToken]] = await db.query(
      `SELECT 
         appointment_type,
         appointment_slot,
         token_number
       FROM appointments
       WHERE patient_id = ?
       AND appointment_date = CURDATE()
       AND appointment_type IN ('CLINIC','HOSPITAL')
       AND status IN ('PENDING','ACCEPTED')
       ORDER BY appointment_slot, token_number
       LIMIT 1`,
      [patientId],
    );

    // -------------------------------
    // 3️⃣ Upcoming appointments list
    // -------------------------------
    const [appointments] = await db.query(
      `SELECT
        a.id,
        d.doctorName,
        d.specialization,
        a.appointment_type,
        a.appointment_date,
        a.appointment_slot,
        a.token_number,
        a.status
       FROM appointments a
       JOIN doctors d ON a.doctor_id = d.user_id
       WHERE a.patient_id = ?
       AND a.appointment_date >= CURDATE()
       AND a.status IN ('PENDING','ACCEPTED')
       ORDER BY a.appointment_date ASC, a.appointment_slot, a.token_number`,
      [patientId],
    );

    return res.status(200).json({
      upcomingCount: upcoming.count,
      todayToken: todayToken
        ? {
            type: todayToken.appointment_type,
            slot: todayToken.appointment_slot,
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

// PATIENT CLINIC / HOSPITAL BOOKING

// PATIENT searchVisitDoctors

exports.searchVisitDoctors = async (req, res) => {
  const search = req.query.search?.trim() || "";
  const city = req.query.city?.trim() || "";

  try {
    const [doctors] = await db.query(
      `SELECT 
        d.user_id AS doctorId,
        d.doctorName,
        d.specialization,
        d.clinicName AS placeName,
        d.place_type AS placeType,
        d.city,
        d.rating,
        d.consultationFee
       FROM doctors d
       WHERE d.status = 'APPROVED'
       AND (
         ? = '' OR
         d.doctorName LIKE ?
         OR d.specialization LIKE ?
         OR d.clinicName LIKE ?
       )
       AND (? = '' OR d.city LIKE ?)
       ORDER BY d.rating DESC`,
      [search, `%${search}%`, `%${search}%`, `%${search}%`, city, `%${city}%`],
    );

    res.status(200).json({
      count: doctors.length,
      doctors,
    });
  } catch (err) {
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// getdoctorname controller

exports.getDoctorNames = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT DISTINCT doctorName AS name
      FROM doctors
      WHERE status = 'APPROVED'
      AND doctorName IS NOT NULL
      ORDER BY doctorName
    `);

    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({
      message: "Failed to fetch doctor names",
      error: err.message,
    });
  }
};

// getCities controller
exports.getCities = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT DISTINCT city AS name
      FROM doctors
      WHERE status = 'APPROVED'
      AND city IS NOT NULL
      ORDER BY city
    `);

    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({
      message: "Failed to fetch cities",
      error: err.message,
    });
  }
};

// disease controller
exports.getDiseases = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT DISTINCT specialization AS name
      FROM doctors
      WHERE status = 'APPROVED'
      AND specialization IS NOT NULL
      ORDER BY specialization
    `);

    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({
      message: "Failed to fetch diseases",
      error: err.message,
    });
  }
};

//
// returns both clinic & hospital names controller

exports.getPlaceNames = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT DISTINCT clinicName AS name
      FROM doctors
      WHERE status = 'APPROVED'
      AND clinicName IS NOT NULL
      ORDER BY clinicName
    `);

    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({
      message: "Failed to fetch place names",
      error: err.message,
    });
  }
};

// PATIENT bookVisitAppointment

exports.bookVisitAppointment = async (req, res) => {
  const patientId = req.user.id;
  const {
    doctorId,
    appointmentType,
    bookingFor,
    familyMemberId,
    appointmentDate,
  } = req.body;

  if (!doctorId || !appointmentType || !appointmentDate) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  if (!["CLINIC", "HOSPITAL"].includes(appointmentType)) {
    return res.status(400).json({ message: "Invalid appointment type" });
  }

  // ✅ Date validation (NEXT 7 DAYS ONLY)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const selectedDate = new Date(appointmentDate);
  selectedDate.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((selectedDate - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0 || diffDays >= 7) {
    return res.status(400).json({
      message: "You can book appointments only for the next 7 days",
    });
  }

  // 🔥 SHIFT DETECTION (UNIFIED – SAME AS QR)
  const hour = new Date().getHours();
  let shift;

  if (hour >= 6 && hour < 14) {
    shift = "MORNING";
  } else if (hour >= 14 && hour < 22) {
    shift = "EVENING";
  } else {
    return res.status(400).json({
      message: "Booking closed (night hours)",
    });
  }

  const MAX_TOKENS_PER_SHIFT = 50;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 🔒 SHARED TOKEN POOL (QR + NORMAL COMBINED)
    const [[row]] = await connection.query(
      `SELECT COUNT(*) AS totalTokens,
              MAX(token_number) AS lastToken
       FROM appointments
       WHERE doctor_id = ?
       AND appointment_date = ?
       AND appointment_slot = ?
       FOR UPDATE`,
      [doctorId, appointmentDate, shift],
    );

    if (row.totalTokens >= MAX_TOKENS_PER_SHIFT) {
      throw new Error(`${shift} shift booking closed (50 tokens full)`);
    }

    const nextToken = (row.lastToken || 0) + 1;

    // 📝 INSERT APPOINTMENT
    const [insertResult] = await connection.query(
      `INSERT INTO appointments
       (appointment_type, patient_id, family_member_id, doctor_id,
        appointment_date, appointment_slot, token_number,
        status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', 'PATIENT')`,
      [
        appointmentType,
        patientId,
        bookingFor === "FAMILY_MEMBER" ? familyMemberId : null,
        doctorId,
        appointmentDate,
        shift,
        nextToken,
      ],
    );

    const appointmentId = insertResult.insertId;

    // ⏰ REMINDERS
    await connection.query(
      `INSERT INTO reminders (appointment_id, reminder_type, scheduled_at)
       VALUES
       (?, 'DAY_BEFORE', DATE_SUB(?, INTERVAL 1 DAY)),
       (?, 'SAME_DAY', DATE_SUB(?, INTERVAL 2 HOUR))`,
      [appointmentId, appointmentDate, appointmentId, appointmentDate],
    );

    await connection.commit();

    // 🔔 EVENT
    eventBus.emit(APPOINTMENT_REQUESTED, {
      eventType: APPOINTMENT_REQUESTED,
      appointmentId,
      appointmentTime: appointmentDate,
      patient: { id: patientId },
      doctor: { id: doctorId },
      shift,
      source: "NORMAL",
    });

    return res.status(201).json({
      message: "Appointment booked successfully",
      date: appointmentDate,
      shift,
      token: nextToken,
    });
  } catch (err) {
    await connection.rollback();

    if (err.message.includes("shift booking closed")) {
      return res.status(409).json({
        message: err.message,
      });
    }

    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  } finally {
    connection.release();
  }
};

// PATIENT getClinicAppointments

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
      [patientId],
    );

    res.status(200).json({ appointments });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// PATIENT cancelClinicAppointment

exports.cancelAppointment = async (req, res) => {
  const patientId = req.user.id;
  const appointmentId = req.params.id;

  try {
    const [result] = await db.query(
      `UPDATE appointments
       SET status = 'CANCELLED'
       WHERE id = ?
       AND patient_id = ?
       AND appointment_type IN ('CLINIC','HOSPITAL')
       AND status IN ('PENDING','ACCEPTED')
       AND appointment_date > CURDATE()`,
      [appointmentId, patientId],
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({
        message: "Cannot cancel appointment (already started or invalid)",
      });
    }

    // 🔥 STEP 4.A — EVENT EMIT (AFTER SUCCESSFUL UPDATE)
    eventBus.emit(APPOINTMENT_CANCELLED_BY_PATIENT, {
      eventType: APPOINTMENT_CANCELLED_BY_PATIENT,
      appointmentId,
      patient: {
        id: patientId,
      },
      // doctorId handler me fetch / payload enhance STEP 4.B me hoga
    });

    return res.status(200).json({
      message: "Appointment cancelled successfully",
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
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
        a.appointment_slot,
        a.token_number,
        a.status,
        a.created_by
       FROM appointments a
       JOIN doctors d ON a.doctor_id = d.user_id
       WHERE a.patient_id = ?
       AND a.appointment_type IN ('CLINIC','HOSPITAL')
       AND a.status IN ('COMPLETED','CANCELLED','REJECTED')
       ORDER BY a.appointment_date DESC, a.appointment_slot, a.token_number`,
      [patientId],
    );

    return res.status(200).json({ appointments });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getUpcomingAppointments = async (req, res) => {
  const patientId = req.user.id;
  const filter = req.query.filter;

  let dateCondition = "a.appointment_date >= CURDATE()";

  if (filter === "today") {
    dateCondition = "a.appointment_date = CURDATE()";
  } else if (filter === "next7") {
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
        a.appointment_slot,
        a.token_number,
        a.status
       FROM appointments a
       JOIN doctors d ON a.doctor_id = d.user_id
       WHERE a.patient_id = ?
       AND ${dateCondition}
       AND a.status IN ('PENDING','ACCEPTED')
       ORDER BY a.appointment_date, a.appointment_slot, a.token_number`,
      [patientId],
    );

    res.json({ appointments });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// PATIENT qrBookVisit

exports.qrBookVisit = async (req, res) => {
  const patientId = req.user.id;
  const { doctorId, appointmentType, bookingFor, familyMemberId } = req.body;

  if (!doctorId || !appointmentType) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  if (!["CLINIC", "HOSPITAL"].includes(appointmentType)) {
    return res.status(400).json({ message: "Invalid appointment type" });
  }

  const appointmentDate = new Date().toISOString().slice(0, 10);

  // 🔥 SHIFT DETECTION (UNIFIED)
  const hour = new Date().getHours();
  let shift;

  if (hour >= 6 && hour < 14) {
    shift = "MORNING";
  } else if (hour >= 14 && hour < 22) {
    shift = "EVENING";
  } else {
    return res.status(400).json({
      message: "Booking closed (night hours)",
    });
  }

  const MAX_TOKENS_PER_SHIFT = 50;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 1️⃣ Doctor availability (LOCK)
    const [[doctor]] = await connection.query(
      `SELECT user_id
       FROM doctors
       WHERE user_id = ?
       AND status = 'APPROVED'
       AND is_available = TRUE
       FOR UPDATE`,
      [doctorId],
    );

    if (!doctor) {
      await connection.rollback();
      return res.status(400).json({
        message: "Doctor is not available for booking",
      });
    }

    // 2️⃣ Duplicate shift booking check (patient-wise)
    const [[existing]] = await connection.query(
      `SELECT id
       FROM appointments
       WHERE patient_id = ?
       AND doctor_id = ?
       AND appointment_date = ?
       AND appointment_slot = ?
       AND status IN ('PENDING','ACCEPTED','IN_PROGRESS')
       FOR UPDATE`,
      [patientId, doctorId, appointmentDate, shift],
    );

    if (existing) {
      await connection.rollback();
      return res.status(400).json({
        message: "You already have a token for this shift",
      });
    }

    // 3️⃣ 🔒 SHARED TOKEN POOL (QR + NORMAL COMBINED)
    const [[row]] = await connection.query(
      `SELECT COUNT(*) AS totalTokens,
              MAX(token_number) AS lastToken
       FROM appointments
       WHERE doctor_id = ?
       AND appointment_date = ?
       AND appointment_slot = ?
       FOR UPDATE`,
      [doctorId, appointmentDate, shift],
    );

    if (row.totalTokens >= MAX_TOKENS_PER_SHIFT) {
      await connection.rollback();
      return res.status(409).json({
        message: `${shift} shift booking closed (50 tokens full)`,
      });
    }

    const nextToken = (row.lastToken || 0) + 1;

    // 4️⃣ Insert appointment
    const [insertResult] = await connection.query(
      `INSERT INTO appointments
       (appointment_type, patient_id, family_member_id, doctor_id,
        appointment_date, appointment_slot, token_number,
        status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', 'QR')`,
      [
        appointmentType,
        patientId,
        bookingFor === "FAMILY_MEMBER" ? familyMemberId : null,
        doctorId,
        appointmentDate,
        shift,
        nextToken,
      ],
    );

    const appointmentId = insertResult.insertId;

    await connection.commit();

    // 🔔 EVENT
    eventBus.emit(APPOINTMENT_REQUESTED, {
      eventType: APPOINTMENT_REQUESTED,
      appointmentId,
      patient: { id: patientId },
      doctor: { id: doctorId },
      shift,
      source: "QR",
    });

    return res.status(201).json({
      message: "QR appointment booked successfully",
      token: nextToken,
      shift,
    });
  } catch (err) {
    await connection.rollback();
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  } finally {
    connection.release();
  }
};

exports.getTokenStatus = async (req, res) => {
  const patientId = req.user.id;
  const { appointmentId } = req.params;

  try {
    // 1️⃣ Validate appointment
    const [[appointment]] = await db.query(
      `SELECT 
        a.id,
        a.doctor_id,
        a.token_number,
        a.appointment_date,
        d.avg_consultation_time
       FROM appointments a
       JOIN doctors d ON d.user_id = a.doctor_id
       WHERE a.id = ?
       AND a.patient_id = ?
       AND a.appointment_date = CURDATE()`,
      [appointmentId, patientId],
    );

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    // 2️⃣ Check current IN_PROGRESS token
    const [[inProgress]] = await db.query(
      `SELECT token_number
       FROM appointments
       WHERE doctor_id = ?
       AND appointment_date = CURDATE()
       AND status = 'IN_PROGRESS'
       ORDER BY token_number
       LIMIT 1`,
      [appointment.doctor_id],
    );

    let nowServing;

    if (inProgress) {
      nowServing = inProgress.token_number;
    } else {
      // fallback to first ACCEPTED
      const [[accepted]] = await db.query(
        `SELECT MIN(token_number) AS token
         FROM appointments
         WHERE doctor_id = ?
         AND appointment_date = CURDATE()
         AND status = 'ACCEPTED'`,
        [appointment.doctor_id],
      );

      nowServing = accepted.token || appointment.token_number;
    }

    const estimatedWaitMinutes =
      Math.max(appointment.token_number - nowServing, 0) *
      appointment.avg_consultation_time;

    return res.json({
      yourToken: appointment.token_number,
      nowServing,
      estimatedWaitMinutes,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
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

  if (!ALLOWED_RELATIONS.includes(relation)) {
    return res.status(400).json({ message: "Invalid relation type" });
  }

  if (dob && isFutureDate(dob)) {
    return res.status(400).json({ message: "DOB cannot be in the future" });
  }

  if (heightCm && isNaN(heightCm)) {
    return res.status(400).json({ message: "Invalid height value" });
  }

  if (weightKg && isNaN(weightKg)) {
    return res.status(400).json({ message: "Invalid weight value" });
  }

  try {
    // 🚫 Duplicate check
    const [[exists]] = await db.query(
      `SELECT id FROM family_members
       WHERE patient_id = ? AND full_name = ? AND relation = ?`,
      [patientId, fullName, relation],
    );

    if (exists) {
      return res.status(409).json({
        message: "Family member already exists",
      });
    }

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
      ],
    );

    return res.status(201).json({
      message: "Family member added successfully",
    });
  } catch (err) {
    return res.status(500).json({
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
      [patientId],
    );

    return res.json({ members });
  } catch (err) {
    return res.status(500).json({
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
    if (isFutureDate(dob)) {
      return res.status(400).json({ message: "DOB cannot be in the future" });
    }
    fields.push("dob = ?");
    values.push(dob);
  }

  if (bloodGroup) {
    fields.push("blood_group = ?");
    values.push(bloodGroup);
  }

  if (heightCm) {
    if (isNaN(heightCm)) {
      return res.status(400).json({ message: "Invalid height value" });
    }
    fields.push("height_cm = ?");
    values.push(heightCm);
  }

  if (weightKg) {
    if (isNaN(weightKg)) {
      return res.status(400).json({ message: "Invalid weight value" });
    }
    fields.push("weight_kg = ?");
    values.push(weightKg);
  }

  if (relation) {
    if (!ALLOWED_RELATIONS.includes(relation)) {
      return res.status(400).json({ message: "Invalid relation type" });
    }
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
      values,
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Family member not found",
      });
    }

    return res.json({
      message: "Family member updated successfully",
    });
  } catch (err) {
    return res.status(500).json({
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
      [id, patientId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Family member not found",
      });
    }

    return res.json({
      message: "Family member deleted successfully",
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// End Family Members

// Patient Notification

exports.getPatientNotifications = async (req, res) => {
  const patientId = req.user.id;

  try {
    const [notifications] = await db.query(
      `SELECT id, title, message, appointment_id, is_read, created_at
       FROM notifications
       WHERE receiver_id = ?
       AND receiver_role = 'PATIENT'
       ORDER BY created_at DESC`,
      [patientId],
    );

    res.json({ notifications });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.markNotificationRead = async (req, res) => {
  const patientId = req.user.id;
  const { id } = req.params;

  try {
    const [result] = await db.query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE id = ?
       AND receiver_id = ?
       AND receiver_role = 'PATIENT'
       AND is_read = FALSE`,
      [id, patientId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Notification not found or already read",
      });
    }

    res.json({ message: "Notification marked as read" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.getUnreadNotificationCount = async (req, res) => {
  const patientId = req.user.id;

  const [[row]] = await db.query(
    `SELECT COUNT(*) AS count
     FROM notifications
     WHERE receiver_id = ?
     AND receiver_role = 'PATIENT'
     AND is_read = FALSE`,
    [patientId],
  );

  res.json({ unreadCount: row.count });
};

// Patient submitDoctorFeedback

exports.submitDoctorReview = async (req, res) => {
  const patientId = req.user.id;
  const { appointmentId, doctorId, rating, comment } = req.body;

  if (rating < 1 || rating > 5) {
    return res.status(400).json({ message: "Rating must be 1 to 5" });
  }

  try {
    // 1️⃣ Save feedback
    await db.query(
      `INSERT INTO doctor_feedback
       (appointment_id, doctor_id, patient_id, rating, comment)
       VALUES (?, ?, ?, ?, ?)`,
      [appointmentId, doctorId, patientId, rating, comment],
    );

    // 2️⃣ Update doctor rating
    await db.query(
      `UPDATE doctors
       SET rating =
         ((rating * rating_count) + ?) / (rating_count + 1),
           rating_count = rating_count + 1
       WHERE user_id = ?`,
      [rating, doctorId],
    );

    res.json({ message: "Feedback submitted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// Patient getVisitSummary

exports.getVisitSummary = async (req, res) => {
  const patientId = req.user.id;
  const { id } = req.params; // appointmentId

  try {
    const [[summary]] = await db.query(
      `SELECT
         vs.notes,
         vs.prescription,
         vs.follow_up_date,
         a.appointment_date,
         d.doctorName,
         d.specialization
       FROM visit_summaries vs
       JOIN appointments a ON a.id = vs.appointment_id
       JOIN doctors d ON d.user_id = a.doctor_id
       WHERE vs.appointment_id = ?
       AND a.patient_id = ?`,
      [id, patientId],
    );

    if (!summary) {
      return res.status(404).json({
        message: "Visit summary not available",
      });
    }

    res.json(summary);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

