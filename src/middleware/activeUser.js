const db = require("../config/db"); 

exports.requireActiveUser = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [[user]] = await db.query(
      "SELECT is_active FROM users WHERE id = ?",
      [userId]
    );

    if (!user || !user.is_active) {
      return res.status(403).json({ message: "User not active" });
    }

    next();
  } catch (err) {
    console.error("requireActiveUser error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
