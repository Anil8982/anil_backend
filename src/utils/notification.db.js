const db = require("../config/db");

async function createAppNotification({
  userId,
  role,
  title,
  message,
  appointmentId = null,
}) {
  try {
    const sql = `
      INSERT INTO notifications
      (receiver_id, receiver_role, title, message, appointment_id, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, false, NOW())
    `;

    await db.execute(sql, [userId, role, title, message, appointmentId]);
  } catch (error) {
    console.error("Failed to insert app notification:", error);
  }
}

module.exports = {
  createAppNotification,
};
