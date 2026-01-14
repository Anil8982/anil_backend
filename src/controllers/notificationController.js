const db = require("../config/db");

exports.getMyNotifications = async (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;

  try {
    const [rows] = await db.query(
      `SELECT id, title, message, appointment_id, is_read, created_at
       FROM notifications
       WHERE receiver_id = ?
       AND receiver_role = ?
       ORDER BY created_at DESC`,
      [userId, role]
    );

    res.json({ notifications: rows });
  } catch (err) {
    res.status(500).json({
      message: "Failed to fetch notifications",
      error: err.message,
    });
  }
};

exports.markAsRead = async (req, res) => {
  const userId = req.user.id;
  const id = req.params.id;

  await db.query(
    `UPDATE notifications
     SET is_read = 1
     WHERE id = ?
     AND receiver_id = ?`,
    [id, userId]
  );

  res.json({ message: "Notification marked as read" });
};
