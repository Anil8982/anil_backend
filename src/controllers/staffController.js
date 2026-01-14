// STAFF / NURSE – Manual Visit Booking
exports.manualVisitBooking = async (req, res) => {
  const staffId = req.user.id; // optional, for audit
  const {
    doctorId,
    appointmentType,
    slot // MORNING | EVENING
  } = req.body;

  if (
    !doctorId ||
    !["CLINIC", "HOSPITAL"].includes(appointmentType) ||
    !["MORNING", "EVENING"].includes(slot)
  ) {
    return res.status(400).json({
      message: "Invalid request data",
    });
  }

  try {
    // 🔍 1️⃣ Doctor must be APPROVED & AVAILABLE
    const [[doctor]] = await db.query(
      `SELECT user_id
       FROM doctors
       WHERE user_id = ?
       AND status = 'APPROVED'
       AND is_available = TRUE`,
      [doctorId]
    );

    if (!doctor) {
      return res.status(400).json({
        message: "Doctor is not available for booking",
      });
    }

    // 🔢 2️⃣ Token generation (date + slot based)
    const [[row]] = await db.query(
      `SELECT MAX(token_number) AS lastToken
       FROM appointments
       WHERE doctor_id = ?
       AND appointment_date = CURDATE()
       AND appointment_type = ?
       AND appointment_slot = ?`,
      [doctorId, appointmentType, slot]
    );

    const nextToken = (row.lastToken || 0) + 1;

    // ✅ 3️⃣ Insert appointment (walk-in patient)
    await db.query(
      `INSERT INTO appointments
       (appointment_type, doctor_id,
        appointment_date, appointment_slot,
        token_number, status, created_by)
       VALUES (?, ?, CURDATE(), ?, ?, 'PENDING', 'STAFF')`,
      [appointmentType, doctorId, slot, nextToken]
    );

    return res.status(201).json({
      message: "Manual appointment booked successfully",
      token: nextToken,
      slot,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};
