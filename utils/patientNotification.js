const createNotification = async ({
  receiverId,
  receiverRole,
  title,
  message,
  appointmentId = null
}) => {
  await db.query(
    `INSERT INTO notifications
     (receiver_id, receiver_role, title, message, appointment_id)
     VALUES (?, ?, ?, ?, ?)`,
    [receiverId, receiverRole, title, message, appointmentId]
  );
};


