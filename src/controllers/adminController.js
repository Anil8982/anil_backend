const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");


// GET /admin/dashboard
// GET  /admin/doctors?status=PENDING
// PUT  /admin/doctors/:id/approve
// PUT  /admin/doctors/:id/reject



exports.getDashboard = async (req, res) => {
  const [[doctors]] = await db.query(
    `SELECT COUNT(*) total,
            SUM(status='PENDING') pending
     FROM doctors`
  );

  const [[patients]] = await db.query(
    `SELECT COUNT(*) total
     FROM users WHERE role='PATIENT'`
  );

  const [[appointments]] = await db.query(
    `SELECT COUNT(*) total
     FROM appointments WHERE appointment_date = CURDATE()`
  );

  res.json({
    doctors,
    patients,
    todayAppointments: appointments.total
  });
};


exports.getDoctors = async (req, res) => {
  const status = req.query.status;

  const [doctors] = await db.query(
    `SELECT * FROM doctors ${status ? "WHERE status=?" : ""}`,
    status ? [status] : []
  );

  res.json({ doctors });
};

exports.approveDoctor = async (req, res) => {
  await db.query(
    `UPDATE doctors SET status='APPROVED' WHERE user_id=?`,
    [req.params.id]
  );
  res.json({ message: "Doctor approved" });
};

exports.rejectDoctor = async (req, res) => {
  await db.query(
    `UPDATE doctors SET status='REJECTED' WHERE user_id=?`,
    [req.params.id]
  );
  res.json({ message: "Doctor rejected" });
};


// GET /admin/patients
// PUT /admin/users/:id/block
// PUT /admin/users/:id/unblock




exports.getPatients = async (req, res) => {
  const [patients] = await db.query(
    `SELECT id, loginId, is_active FROM users WHERE role='PATIENT'`
  );
  res.json({ patients });
};

exports.blockUser = async (req, res) => {
  await db.query(
    `UPDATE users SET is_active=FALSE WHERE id=?`,
    [req.params.id]
  );
  res.json({ message: "User blocked" });
};

exports.unblockUser = async (req, res) => {
  await db.query(
    `UPDATE users SET is_active=TRUE WHERE id=?`,
    [req.params.id]
  );
  res.json({ message: "User unblocked" });
};



// ADMIN → ALL APPOINTMENTS VIEW
// GET /admin/appointments


exports.getAllAppointments = async (req, res) => {
  const { doctorId, date, status } = req.query;

  let query = `SELECT * FROM appointments WHERE 1=1`;
  const params = [];

  if (doctorId) { query += " AND doctor_id=?"; params.push(doctorId); }
  if (date) { query += " AND appointment_date=?"; params.push(date); }
  if (status) { query += " AND status=?"; params.push(status); }

  const [rows] = await db.query(query, params);
  res.json({ appointments: rows });
};


// FORCE CANCEL APPOINTMENT (ADMIN POWER)
// PUT /admin/appointments/:id/cancel


exports.forceCancelAppointment = async (req, res) => {
  await db.query(
    `UPDATE appointments SET status='CANCELLED' WHERE id=?`,
    [req.params.id]
  );
  res.json({ message: "Appointment cancelled by admin" });
};



// GET /admin/analytics
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
