// const db = require("../config/db");

// exports.logNotification = async ({
//   userId,
//   role,
//   type,
//   channel,
//   message,
//   status = "SENT",
// }) => {
//   await db.query(
//     `INSERT INTO notification_logs
//      (user_id, role, type, channel, message, status)
//      VALUES (?, ?, ?, ?, ?, ?)`,
//     [userId, role, type, channel, message, status]
//   );
// };

const db = require("../config/db");

/**
 * Check if notification was already sent
 */
async function isNotificationAlreadySent({
  eventType,
  userId,
  entityId,
  channel,
}) {
  const sql = `
    SELECT id FROM notification_logs
    WHERE event_type = ?
      AND user_id = ?
      AND entity_id = ?
      AND channel = ?
    LIMIT 1
  `;

  const [rows] = await db.execute(sql, [eventType, userId, entityId, channel]);

  return rows.length > 0;
}

/**
 * Log notification attempt
 */
async function logNotification({
  eventType,
  userId,
  entityId,
  channel,
  status,
  errorMessage = null,
}) {
  try {
    const sql = `
      INSERT INTO notification_logs
      (event_type, user_id, entity_id, channel, status, error_message, created_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `;

    await db.execute(sql, [
      eventType,
      userId,
      entityId,
      channel,
      status,
      errorMessage,
    ]);
  } catch (error) {
    console.error("Failed to log notification:", error);
  }
}

module.exports = {
  isNotificationAlreadySent,
  logNotification,
};
