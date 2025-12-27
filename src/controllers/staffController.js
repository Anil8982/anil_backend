// PATIENT manualVisitBooking

exports.manualVisitBooking = async (req, res) => {
  const { doctorId, appointmentType } = req.body;

  if (!doctorId || !["CLINIC","HOSPITAL"].includes(appointmentType)) {
    return res.status(400).json({ message: "Invalid request" });
  }

  try {
    const [[row]] = await db.query(
      `SELECT MAX(token_number) AS lastToken
       FROM appointments
       WHERE doctor_id = ?
       AND appointment_date = CURDATE()
       AND appointment_type = ?`,
      [doctorId, appointmentType]
    );

    const nextToken = (row.lastToken || 0) + 1;

    await db.query(
      `INSERT INTO appointments
       (appointment_type, doctor_id,
        appointment_date, token_number, status, created_by)
       VALUES (?, ?, CURDATE(), ?, 'PENDING', 'STAFF')`,
      [appointmentType, doctorId, nextToken]
    );

    return res.status(201).json({
      message: "Manual appointment booked",
      token: nextToken
    });

  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};
