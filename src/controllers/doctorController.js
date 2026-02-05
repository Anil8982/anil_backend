const db = require("../config/db");
const bcrypt = require("bcryptjs");
const upload = require("../middleware/upload.middleware");

const eventBus = require("../events/eventBus");
const {
  APPOINTMENT_CONFIRMED,
  APPOINTMENT_REJECTED,
  APPOINTMENT_REMINDER,
} = require("../events/notification.events");

exports.register = async (req, res) => {
  const {
    placeType,
    placeName,
    doctorName,
    degree,
    licenseNumber,
    specialization,
    city,
    address,
    consultationFee,
    timings,
    availableDays,
    experienceYears,
    email,
    phone, // ✅ mobile number
    password,
    confirmPassword,
  } = req.body;

  // --------------------
  // Basic validations
  // --------------------
  if (
    !doctorName ||
    !email ||
    !phone ||
    !password ||
    !confirmPassword ||
    !licenseNumber ||
    !specialization
  ) {
    return res.status(400).json({ message: "Required fields missing" });
  }

  if (!["CLINIC", "HOSPITAL"].includes(placeType)) {
    return res.status(400).json({
      message: "Please select clinic or hospital",
    });
  }

  if (!placeName) {
    return res.status(400).json({
      message:
        placeType === "CLINIC"
          ? "Clinic name is required"
          : "Hospital name is required",
    });
  }

  if (!Array.isArray(availableDays)) {
    return res.status(400).json({
      message: "availableDays must be an array",
    });
  }

  if (experienceYears === undefined || experienceYears < 0) {
    return res.status(400).json({
      message: "Valid experience years required",
    });
  }

  // --------------------
  // Email & mobile checks
  // --------------------
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: "Invalid email format" });
  }

  if (!/^\d{10}$/.test(phone)) {
    return res.status(400).json({ message: "Invalid mobile number" });
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

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // --------------------
    // Check existing user (email OR mobile)
    // --------------------
    const [existingUser] = await connection.query(
      `SELECT id FROM users WHERE email = ? OR mobile = ?`,
      [email, phone],
    );

    if (existingUser.length > 0) {
      await connection.rollback();
      return res.status(409).json({ message: "Doctor already exists" });
    }

    // --------------------
    // Check license number
    // --------------------
    const [[licenseCheck]] = await connection.query(
      "SELECT id FROM doctors WHERE licenseNumber = ?",
      [licenseNumber],
    );

    if (licenseCheck) {
      await connection.rollback();
      return res
        .status(409)
        .json({ message: "License number already registered" });
    }

    // --------------------
    // Hash password
    // --------------------
    const hashedPassword = await bcrypt.hash(password, 10);

    // --------------------
    // Insert into users ()
    // --------------------
    const [userResult] = await connection.query(
      `INSERT INTO users (email, mobile, password, role)
       VALUES (?, ?, ?, 'DOCTOR')`,
      [email, phone, hashedPassword],
    );

    const userId = userResult.insertId;

    // --------------------
    // Insert into doctors
    // --------------------
    await connection.query(
      `INSERT INTO doctors
       (user_id, doctorName, degree, licenseNumber, specialization, email,
        clinicName, place_type, city, address, consultationFee, timings,
        availableDays, experience_years, rating, rating_count, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        doctorName,
        degree,
        licenseNumber,
        specialization,
        email,
        placeName,
        placeType,
        city,
        address,
        consultationFee,
        timings,
        JSON.stringify(availableDays),
        experienceYears,
        2.0,
        0,
        "PENDING",
      ],
    );

    await connection.commit();

    return res.status(201).json({
      message: "Doctor registered successfully. Waiting for admin approval.",
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

// doctor  respondAppointment

exports.respondAppointment = async (req, res) => {
  const doctorId = req.user.id;
  const { id: appointmentId } = req.params;
  const { action } = req.body;

  if (!["ACCEPT", "REJECT"].includes(action)) {
    return res.status(400).json({ message: "Invalid action" });
  }

  const newStatus = action === "ACCEPT" ? "ACCEPTED" : "REJECTED";

  try {
    const [[appointment]] = await db.query(
      `SELECT patient_id
       FROM appointments
       WHERE id = ?
       AND doctor_id = ?
       AND status = 'PENDING'`,
      [appointmentId, doctorId],
    );

    if (!appointment) {
      return res.status(400).json({
        message: "Appointment not found or already processed",
      });
    }

    await db.query(
      `UPDATE appointments
       SET status = ?
       WHERE id = ?`,
      [newStatus, appointmentId],
    );

    // 🔒 SAFE EVENT EMIT (NO CRASH)
    if (eventBus?.emit) {
      if (action === "ACCEPT") {
        eventBus.emit(APPOINTMENT_CONFIRMED, {
          eventType: APPOINTMENT_CONFIRMED,
          appointmentId,
          patient: { id: appointment.patient_id },
          doctor: { id: doctorId },
        });
      } else {
        eventBus.emit(APPOINTMENT_REJECTED, {
          eventType: APPOINTMENT_REJECTED,
          appointmentId,
          patient: { id: appointment.patient_id },
          doctor: { id: doctorId },
        });
      }
    }

    return res.json({
      message: `Appointment ${newStatus.toLowerCase()}`,
    });
  } catch (err) {
    console.error("respondAppointment error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

exports.getDashboard = async (req, res) => {
  const doctorId = req.user.id;

  try {
    const [[row]] = await db.query(
      `
      SELECT
        SUM(status = 'PENDING') AS pendingRequests,
        SUM(DATE(appointment_date) = CURDATE()) AS todayQueue,
        SUM(status = 'COMPLETED' AND DATE(appointment_date) = CURDATE()) AS completedToday
      FROM appointments
      WHERE doctor_id = ?
      `,
      [doctorId],
    );

    res.json(row);
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
        a.appointment_slot,
        a.token_number,
        a.status,
        a.created_by,
        u.email AS patientEmail,
        fm.full_name AS familyMemberName
       FROM appointments a
       LEFT JOIN users u ON a.patient_id = u.id
       LEFT JOIN family_members fm ON a.family_member_id = fm.id
       WHERE a.doctor_id = ?
       AND a.status IN ('PENDING','ACCEPTED')
       ORDER BY a.appointment_date, a.appointment_slot, a.token_number`,
      [doctorId],
    );

    res.json({ appointments });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.getTodayQueue = async (req, res) => {
  const doctorId = req.user.id;
  const slot = req.query.slot; // MORNING / EVENING

  try {
    const [queue] = await db.query(
      `SELECT
        a.id,
        a.token_number,
        a.status,
        u.email AS patientEmail,
        fm.full_name AS familyMemberName
       FROM appointments a
       LEFT JOIN users u ON a.patient_id = u.id
       LEFT JOIN family_members fm ON a.family_member_id = fm.id
       WHERE a.doctor_id = ?
       AND DATE(a.appointment_date) = CURDATE()
       AND a.appointment_slot = ?
       AND a.status IN ('ACCEPTED','IN_PROGRESS')
       ORDER BY a.token_number`,
      [doctorId, slot],
    );

    res.json({ queue });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.startAppointment = async (req, res) => {
  const doctorId = req.user.id;
  const { id: appointmentId } = req.params;

  try {
    // ✅ Ensure appointment is valid to start
    const [[appointment]] = await db.query(
      `SELECT id
       FROM appointments
       WHERE id = ?
       AND doctor_id = ?
       AND appointment_date = CURDATE()
       AND status = 'ACCEPTED'`,
      [appointmentId, doctorId],
    );

    if (!appointment) {
      return res.status(400).json({
        message: "Appointment cannot be started",
      });
    }

    // ✅ Start appointment
    await db.query(
      `UPDATE appointments
       SET status = 'IN_PROGRESS'
       WHERE id = ?`,
      [appointmentId],
    );

    return res.json({
      message: "Appointment started",
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

exports.completeAppointment = async (req, res) => {
  const doctorId = req.user.id;
  const { id } = req.params;

  try {
    const [[appt]] = await db.query(
      `SELECT a.patient_id, u.email
   FROM appointments a
   JOIN users u ON u.id = a.patient_id
   WHERE a.id = ?
   AND a.doctor_id = ?
   AND a.status = 'IN_PROGRESS'`,
      [id, doctorId],
    );

    if (!appt) {
      return res.status(400).json({
        message: "Appointment cannot be completed",
      });
    }

    await db.query(
      `UPDATE appointments
       SET status = 'COMPLETED'
       WHERE id = ?`,
      [id],
    );

    // EMAIL summary notification
    await sendEmail({
      to: appt.email,
      subject: "Visit Completed",
      text: "Your visit is completed. You can view the summary in the app.",
    });

    // APP notification
    await createNotification({
      receiverId: appt.patient_id,
      receiverRole: "PATIENT",
      title: "Appointment Completed",
      message: "Your appointment has been completed",
      appointmentId: id,
    });

    res.json({ message: "Appointment completed" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.getDoctorUnreadCount = async (req, res) => {
  const doctorId = req.user.id;

  const [[row]] = await db.query(
    `SELECT COUNT(*) AS count
     FROM notifications
     WHERE receiver_id = ?
     AND receiver_role = 'DOCTOR'
     AND is_read = FALSE`,
    [doctorId],
  );

  res.json({ unreadCount: row.count });
};

exports.callNextToken = async (req, res) => {
  const doctorId = req.user.id;
  const { slot } = req.body;

  if (!slot) {
    return res.status(400).json({ message: "Slot is required" });
  }

  try {
    // 1️⃣ Complete current IN_PROGRESS
    const [[current]] = await db.query(
      `SELECT id
       FROM appointments
       WHERE doctor_id = ?
       AND appointment_date = CURDATE()
       AND appointment_slot = ?
       AND status = 'IN_PROGRESS'`,
      [doctorId, slot],
    );

    if (current) {
      await db.query(
        `UPDATE appointments
         SET status = 'COMPLETED'
         WHERE id = ?`,
        [current.id],
      );
    }

    // 2️⃣ Get NEXT ACCEPTED
    const [[next]] = await db.query(
      `SELECT id, patient_id, token_number
       FROM appointments
       WHERE doctor_id = ?
       AND appointment_date = CURDATE()
       AND appointment_slot = ?
       AND status = 'ACCEPTED'
       ORDER BY token_number ASC
       LIMIT 1`,
      [doctorId, slot],
    );

    if (!next) {
      return res.json({ message: "No more tokens in queue" });
    }

    // 3️⃣ Mark NEXT as IN_PROGRESS
    await db.query(
      `UPDATE appointments
       SET status = 'IN_PROGRESS'
       WHERE id = ?`,
      [next.id],
    );

    // 🔥 EVENT — CURRENT PATIENT TURN
    eventBus.emit(APPOINTMENT_REMINDER, {
      eventType: APPOINTMENT_REMINDER,
      appointmentId: next.id,
      patient: { id: next.patient_id },
      meta: { type: "NOW", token: next.token_number },
    });

    // 4️⃣ Near-turn patients (next 2)
    const [nearPatients] = await db.query(
      `SELECT id, patient_id
       FROM appointments
       WHERE doctor_id = ?
       AND appointment_date = CURDATE()
       AND appointment_slot = ?
       AND status = 'ACCEPTED'
       AND token_number > ?
       ORDER BY token_number ASC
       LIMIT 2`,
      [doctorId, slot, next.token_number],
    );

    for (const p of nearPatients) {
      eventBus.emit(APPOINTMENT_REMINDER, {
        eventType: APPOINTMENT_REMINDER,
        appointmentId: p.id,
        patient: { id: p.patient_id },
        meta: { type: "NEAR" },
      });
    }

    return res.json({
      message: "Next token called",
      token: next.token_number,
      slot,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

exports.getDoctorProfile = async (req, res) => {
  const doctorId = req.user.id;

  try {
    const [[doctor]] = await db.query(
      `SELECT
        doctorName,
        degree,
        specialization,
        clinicName AS placeName,
        place_type AS placeType,
        city,
        address,
        consultationFee,
        timings,
        availableDays,
        experience_years AS experienceYears,
        rating,
        rating_count,
        status
       FROM doctors
       WHERE user_id = ?`,
      [doctorId],
    );

    if (!doctor) {
      return res.status(404).json({ message: "Doctor profile not found" });
    }

    doctor.availableDays = JSON.parse(doctor.availableDays);

    res.json({ doctor });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateDoctorProfile = async (req, res) => {
  const doctorId = req.user.id;

  const {
    doctorName,
    degree,
    specialization,
    city,
    address,
    consultationFee,
    timings,
    availableDays,
    experienceYears,
  } = req.body;

  if (availableDays && !Array.isArray(availableDays)) {
    return res.status(400).json({
      message: "availableDays must be an array",
    });
  }

  try {
    const [result] = await db.query(
      `UPDATE doctors
       SET
        doctorName = COALESCE(?, doctorName),
        degree = COALESCE(?, degree),
        specialization = COALESCE(?, specialization),
        city = COALESCE(?, city),
        address = COALESCE(?, address),
        consultationFee = COALESCE(?, consultationFee),
        timings = COALESCE(?, timings),
        availableDays = COALESCE(?, availableDays),
        experience_years = COALESCE(?, experience_years)
       WHERE user_id = ?`,
      [
        doctorName,
        degree,
        specialization,
        city,
        address,
        consultationFee,
        timings,
        availableDays ? JSON.stringify(availableDays) : null,
        experienceYears,
        doctorId,
      ],
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ message: "Profile update failed" });
    }

    res.json({ message: "Doctor profile updated successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateAvailability = async (req, res) => {
  const doctorId = req.user.id;
  const { isAvailable } = req.body;

  if (typeof isAvailable !== "boolean") {
    return res.status(400).json({
      message: "isAvailable must be true or false",
    });
  }

  try {
    await db.query(
      `UPDATE doctors
       SET is_available = ?
       WHERE user_id = ?`,
      [isAvailable, doctorId],
    );

    res.json({
      message: `Doctor is now ${isAvailable ? "AVAILABLE" : "UNAVAILABLE"}`,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

//   const patientId = req.user.id;
//   const { appointmentId, rating, review } = req.body;

//   if (rating < 1 || rating > 5) {
//     return res.status(400).json({ message: "Rating must be 1 to 5" });
//   }

//   try {
//     const [[appt]] = await db.query(
//       `SELECT doctor_id
//        FROM appointments
//        WHERE id = ?
//        AND patient_id = ?
//        AND status = 'COMPLETED'`,
//       [appointmentId, patientId]
//     );

//     if (!appt) {
//       return res.status(400).json({
//         message: "Invalid or incomplete appointment",
//       });
//     }

//     await db.query(
//       `INSERT INTO doctor_reviews
//        (doctor_id, patient_id, appointment_id, rating, review)
//        VALUES (?, ?, ?, ?, ?)`,
//       [appt.doctor_id, patientId, appointmentId, rating, review]
//     );

//     // ⭐ Update doctor rating (average)
//     await db.query(
//       `UPDATE doctors
//        SET
//          rating =
//            ((rating * rating_count) + ?) / (rating_count + 1),
//          rating_count = rating_count + 1
//        WHERE user_id = ?`,
//       [rating, appt.doctor_id]
//     );

//     res.status(201).json({
//       message: "Review submitted successfully",
//     });
//   } catch (err) {
//     res.status(500).json({ message: "Server error" });
//   }
// };

exports.getDoctorReviews = async (req, res) => {
  const doctorId = req.user.id;

  try {
    const [reviews] = await db.query(
      `SELECT
        r.rating,
        r.review,
        r.created_at,
        u.email AS patientEmail
       FROM doctor_reviews r
       JOIN users u ON r.patient_id = u.id
       WHERE r.doctor_id = ?
       ORDER BY r.created_at DESC`,
      [doctorId],
    );

    res.json({ reviews });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// addVisitSummary

exports.addVisitSummary = async (req, res) => { 
  const doctorId = req.user.id;
  const { id: appointmentId } = req.params;
  const { notes, prescription, followUpAfterDays } = req.body;

  try {
    /* ================= 1️⃣ VALIDATE APPOINTMENT ================= */
    const [[appt]] = await db.query(
      `SELECT patient_id
       FROM appointments
       WHERE id = ?
       AND doctor_id = ?
       AND status = 'COMPLETED'`,
      [appointmentId, doctorId],
    );

    if (!appt) {
      return res.status(400).json({
        message: "Visit summary can be added only after appointment completion",
      });
    }

    let patientId = appt.patient_id;

    /* ================= FALLBACK FOR WALK-IN / MANUAL ================= */
    if (!patientId) {
      const [[walkin]] = await db.query(
        `SELECT id FROM walkin_patients WHERE appointment_id = ?`,
        [appointmentId],
      );

      if (walkin) {
        patientId = walkin.id;
      }
    }

    if (!patientId) {
      return res.status(400).json({
        message:
          "Cannot attach visit summary because patient record is missing",
      });
    }

    /* ================= 2️⃣ FOLLOW-UP DATE ================= */
    let followUpDate = null;
    if (followUpAfterDays) {
      followUpDate = new Date();
      followUpDate.setDate(followUpDate.getDate() + Number(followUpAfterDays));
    }

    /* ================= 3️⃣ CHECK EXISTING SUMMARY ================= */
    const [[existingSummary]] = await db.query(
      `SELECT id FROM visit_summaries WHERE appointment_id = ?`,
      [appointmentId],
    );

    if (existingSummary) {
      /* ===== UPDATE ===== */
      await db.query(
        `UPDATE visit_summaries
         SET notes = ?, prescription = ?, follow_up_date = ?
         WHERE appointment_id = ?`,
        [notes || null, prescription || null, followUpDate, appointmentId],
      );
    } else {
      /* ===== INSERT ===== */
      await db.query(
        `INSERT INTO visit_summaries
         (appointment_id, notes, prescription, follow_up_date)
         VALUES (?, ?, ?, ?)`,
        [appointmentId, notes || null, prescription || null, followUpDate],
      );
    }

    /* ================= 4️⃣ HEALTH TIMELINE (ONCE ONLY) ================= */
    const [[timelineExists]] = await db.query(
      `SELECT id FROM health_timeline
       WHERE type = 'VISIT_SUMMARY'
       AND reference_id = ?`,
      [appointmentId],
    );

    if (!timelineExists) {
      await db.query(
        `INSERT INTO health_timeline
         (patient_id, type, reference_id, title, description)
         VALUES (?, 'VISIT_SUMMARY', ?, 'Doctor Visit Summary',
                 'Visit summary added by doctor')`,
        [appt.patient_id, appointmentId],
      );
    }

    /* ================= SUCCESS ================= */
    return res.json({
      message: existingSummary
        ? "Visit summary updated successfully"
        : "Visit summary added successfully",
      followUpDate,
      isEdit: !!existingSummary,
    });
  } catch (err) {
    console.error("Add Visit Summary Error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// getDoctorById

exports.getDoctorById = async (req, res) => {
  const { id } = req.params;
  console.log("HIT getDoctorById", req.params.id);
  try {
    const [[doctor]] = await db.query(
      `SELECT 
        d.user_id AS doctorId,
        d.doctorName,
        d.specialization,
        d.place_type,
        d.city
       FROM doctors d
       WHERE d.user_id = ? 
       AND d.status = 'APPROVED'`,
      [id],
    );

    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    res.status(200).json({ doctor });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// DOCTOR – Appointment History
exports.getDoctorAppointmentHistory = async (req, res) => {
  const doctorId = req.user.id;
  const filter = req.query.filter; // today | last7 | all

  let dateCondition = "1=1";

  if (filter === "today") {
    dateCondition = "a.appointment_date = CURDATE()";
  }

  if (filter === "last7") {
    dateCondition =
      "a.appointment_date BETWEEN DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND CURDATE()";
  }

  try {
    const [appointments] = await db.query(
      `SELECT
        a.id,
        a.appointment_type,
        a.appointment_date,
        a.appointment_slot,
        a.token_number,
        a.status,
        a.created_by,

        -- Patient info (if registered)
        u.email AS patientEmail,

        -- Family member info
        fm.full_name AS familyMemberName

       FROM appointments a
       LEFT JOIN users u ON a.patient_id = u.id
       LEFT JOIN family_members fm ON a.family_member_id = fm.id
       WHERE a.doctor_id = ?
       AND ${dateCondition}
       AND a.status IN ('COMPLETED','CANCELLED','REJECTED')
       ORDER BY a.appointment_date DESC, a.token_number DESC`,
      [doctorId],
    );

    res.json({ appointments });
  } catch (err) {
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
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
      [doctorId],
    );

    res.json({ notifications });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// DOCTOR – getMyQR

exports.getMyQR = async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

  console.log("FRONTEND_URL =", frontendUrl);

  const doctorId = req.user.id;

  const [[doctor]] = await db.query(
    `SELECT user_id FROM doctors WHERE user_id = ? AND status = 'APPROVED'`,
    [doctorId],
  );

  if (!doctor) {
    return res.status(403).json({
      message: "Doctor not approved",
    });
  }

  const qrUrl = `${frontendUrl}/client/book-appointment?doctorId=${doctorId}`;

  res.json({ doctorId, qrUrl });
};

// STAFF / NURSE – Manual (Walk-in) Visit Booking

exports.manualVisitBooking = async (req, res) => {
  const staffId = req.user.id;

  const {
    doctorId,
    appointmentType, // metadata only
    slot, // MORNING | EVENING
    patientName,
    patientMobile,
    patientAge,
  } = req.body;

  if (
    !doctorId ||
    !patientName ||
    !patientMobile ||
    !["MORNING", "EVENING"].includes(slot)
  ) {
    return res.status(400).json({
      message: "Invalid request data",
    });
  }

  const appointmentDate = new Date().toISOString().slice(0, 10);
  const MAX_TOKENS_PER_SHIFT = 50;

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 1️⃣ Doctor must be APPROVED & AVAILABLE (LOCK)
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

    // 2️⃣ Insert walk-in patient (independent of token)
    const [walkinResult] = await connection.query(
      `INSERT INTO walkin_patients (name, mobile, age)
       VALUES (?, ?, ?)`,
      [patientName, patientMobile, patientAge || null],
    );

    const walkinPatientId = walkinResult.insertId;

    // 3️⃣ 🔒 SHARED TOKEN POOL (QR + NORMAL + MANUAL)
    const [[row]] = await connection.query(
      `SELECT COUNT(*) AS totalTokens,
              MAX(token_number) AS lastToken
       FROM appointments
       WHERE doctor_id = ?
       AND appointment_date = ?
       AND appointment_slot = ?
       FOR UPDATE`,
      [doctorId, appointmentDate, slot],
    );

    if (row.totalTokens >= MAX_TOKENS_PER_SHIFT) {
      await connection.rollback();
      return res.status(409).json({
        message: `${slot} shift booking closed (50 tokens full)`,
      });
    }

    const nextToken = (row.lastToken || 0) + 1;

    // 4️⃣ Insert appointment (TOKEN FINAL)
    const [appointmentResult] = await connection.query(
      `INSERT INTO appointments
       (appointment_type, doctor_id, patient_id, walkin_patient_id,
        appointment_date, appointment_slot,
        token_number, status, created_by)
       VALUES (?, ?, NULL, ?, ?, ?, ?, 'PENDING', 'STAFF')`,
      [
        appointmentType || "CLINIC",
        doctorId,
        walkinPatientId,
        appointmentDate,
        slot,
        nextToken,
      ],
    );

    const appointmentId = appointmentResult.insertId;

    await connection.commit();

    return res.status(201).json({
      message: "Manual appointment booked successfully",
      token: nextToken,
      slot,
      appointmentId,
      walkinPatientId,
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
