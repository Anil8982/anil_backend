const db = require("../config/db");

exports.logNotification = async ({
  userId,
  role,
  type,
  channel,
  message,
  status = "SENT",
}) => {
  await db.query(
    `INSERT INTO notification_logs 
     (user_id, role, type, channel, message, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, role, type, channel, message, status]
  );
};
