// services/subscription.service.js
const db = require("../db");

exports.createSubscription = async ({
  userId,
  planId,
  paymentId,
  duration,
}) => {
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + duration);

  await db.execute(
    `INSERT INTO subscriptions 
     (user_id, plan_id, start_date, end_date, payment_id)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, planId, startDate, endDate, paymentId],
  );
};

// services/subscription.service.js

exports.getActiveSubscription = async (userId) => {
  const [rows] = await db.execute(
    `SELECT s.*, p.name, p.price
     FROM subscriptions s
     JOIN plans p ON p.id = s.plan_id
     WHERE s.user_id = ? AND s.status = 'active'
     LIMIT 1`,
    [userId]
  )

  return rows[0] || null
}
