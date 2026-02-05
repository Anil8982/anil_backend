const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { DOCTOR_REJECTED } = require("../events/notification.events");
const eventBus = require("../events/eventBus");
const { DOCTOR_APPROVED } = require("../events/notification.events");
const {
  APPOINTMENT_CANCELLED_BY_ADMIN,
} = require("../events/notification.events");

// GET /admin/dashboard


exports.getDashboard = async (req, res) => {
  const [[doctors]] = await db.query(
    `SELECT COUNT(*) total,
            SUM(status='PENDING') pending
     FROM doctors`,
  );

  const [[patients]] = await db.query(
    `SELECT COUNT(*) total
     FROM users WHERE role='PATIENT'`,
  );

  const [[appointments]] = await db.query(
    `SELECT COUNT(*) total
     FROM appointments WHERE appointment_date = CURDATE()`,
  );

  res.json({
    doctors,
    patients,
    todayAppointments: appointments.total,
  });
};

exports.getDoctors = async (req, res) => {
  const status = req.query.status;

  let query = `
    SELECT
      user_id,
      doctorName,
      specialization,
      clinicName,
      place_type,
      city,
      status,
      rating,
      experience_years
    FROM doctors
  `;

  const params = [];

  if (status) {
    query += " WHERE status = ?";
    params.push(status);
  }

  query += " ORDER BY doctorName ASC";

  const [doctors] = await db.query(query, params);

  res.json({ doctors });
};


exports.approveDoctor = async (req, res) => {
  const userId = req.params.id;

  try {
    const [[doctor]] = await db.query(
      `SELECT d.status, d.doctorName
       FROM doctors d
       WHERE d.user_id = ?`,
      [userId],
    );

    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    if (doctor.status !== "PENDING") {
      return res.status(400).json({ message: "Doctor not in pending state" });
    }

    await db.query(`UPDATE doctors SET status = 'APPROVED' WHERE user_id = ?`, [
      userId,
    ]);

    // 🔥 EVENT EMIT
    eventBus.emit(DOCTOR_APPROVED, {
      eventType: DOCTOR_APPROVED,
      doctor: {
        id: userId,
        name: doctor.doctorName,
      },
    });

    return res.json({ message: "Doctor approved successfully" });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

exports.rejectDoctor = async (req, res) => {
  const userId = req.params.id;

  try {
    const [[doctor]] = await db.query(
      `SELECT d.status, d.doctorName
       FROM doctors d
       WHERE d.user_id = ?`,
      [userId],
    );

    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    if (doctor.status !== "PENDING") {
      return res.status(400).json({ message: "Doctor not in pending state" });
    }

    await db.query(`UPDATE doctors SET status = 'REJECTED' WHERE user_id = ?`, [
      userId,
    ]);

    // 🔥 EVENT EMIT
    eventBus.emit(DOCTOR_REJECTED, {
      eventType: DOCTOR_REJECTED,
      doctor: {
        id: userId,
        name: doctor.doctorName,
      },
    });

    return res.json({ message: "Doctor rejected successfully" });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};


exports.getPatients = async (req, res) => {
  const [patients] = await db.query(
    `SELECT id, email, is_active FROM users WHERE role='PATIENT'`,
  );
  res.json({ patients });
};

exports.blockUser = async (req, res) => {
  await db.query(`UPDATE users SET is_active=FALSE WHERE id=?`, [
    req.params.id,
  ]);
  res.json({ message: "User blocked" });
};

exports.unblockUser = async (req, res) => {
  await db.query(`UPDATE users SET is_active=TRUE WHERE id=?`, [req.params.id]);
  res.json({ message: "User unblocked" });
};

// GET /admin/appointments

exports.getAllAppointments = async (req, res) => {
  const { doctorId, date, status } = req.query;

  let query = `
    SELECT
      a.id,
      a.appointment_type,
      a.appointment_date,
      a.appointment_slot,
      a.token_number,
      a.status,
      a.created_by,
      a.created_at,

      d.user_id AS doctorId,
      d.doctorName,

      u.id AS patientId,
      u.email AS patientEmail

    FROM appointments a
    LEFT JOIN doctors d ON d.user_id = a.doctor_id
    LEFT JOIN users u ON u.id = a.patient_id
    WHERE 1 = 1
  `;

  const params = [];

  if (doctorId) {
    query += " AND a.doctor_id = ?";
    params.push(doctorId);
  }

  if (date) {
    query += " AND a.appointment_date = ?";
    params.push(date);
  }

  if (status) {
    query += " AND a.status = ?";
    params.push(status);
  }

  query += " ORDER BY a.appointment_date DESC, a.token_number ASC";

  const [rows] = await db.query(query, params);

  res.json({ appointments: rows });
};

// FORCE CANCEL APPOINTMENT (ADMIN POWER)


exports.forceCancelAppointment = async (req, res) => {
  const appointmentId = req.params.id;

  const [result] = await db.query(
    `UPDATE appointments
     SET status = 'CANCELLED'
     WHERE id = ?
     AND status NOT IN ('COMPLETED','CANCELLED')`,
    [appointmentId],
  );

  if (result.affectedRows === 0) {
    return res.status(400).json({ message: "Cannot cancel appointment" });
  }

  // 🔥 EVENT EMIT
  eventBus.emit(APPOINTMENT_CANCELLED_BY_ADMIN, {
    eventType: APPOINTMENT_CANCELLED_BY_ADMIN,
    appointmentId,
  });

  res.json({ message: "Appointment cancelled by admin" });
};

// ADMIN ANALYTICS (GLOBAL)

exports.getAdminAnalytics = async (req, res) => {
  const [[data]] = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM appointments) totalAppointments,
      (SELECT COUNT(*) FROM doctors WHERE status='APPROVED') activeDoctors,
      (SELECT COUNT(*) FROM users WHERE role='PATIENT') patients
  `);

  res.json(data);
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
      [id, patientId],
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ message: "Cannot cancel appointment" });
    }

    res.json({ message: "Appointment cancelled successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
