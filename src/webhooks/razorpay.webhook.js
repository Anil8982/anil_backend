// // webhooks/razorpay.webhook.js
// const crypto = require("crypto");
// const db = require("../db");

// exports.razorpayWebhook = async (req, res) => {
//   const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

//   const expectedSignature = crypto
//     .createHmac("sha256", secret)
//     .update(req.rawBody)
//     .digest("hex");

//   const receivedSignature = req.headers["x-razorpay-signature"];

//   if (expectedSignature !== receivedSignature) {
//     return res.status(400).json({ message: "Invalid signature" });
//   }

//   const event = req.body;

//   if (event.event === "payment.captured") {
//     const payment = event.payload.payment.entity;

//     const userId = payment.notes.userId;
//     const planId = payment.notes.planId;

//     // 🔴 Safety: old active subscription expire
//     await db.execute(
//       `UPDATE subscriptions 
//        SET status = 'expired' 
//        WHERE user_id = ? AND status = 'active'`,
//       [userId],
//     );

//     // 🔵 Get plan duration
//     const [[plan]] = await db.execute(
//       `SELECT duration FROM plans WHERE id = ?`,
//       [planId],
//     );

//     const startDate = new Date();
//     const endDate = new Date(startDate);
//     endDate.setDate(endDate.getDate() + plan.duration);

//     // 🟢 Create new subscription
//     await db.execute(
//       `INSERT INTO subscriptions 
//        (user_id, plan_id, start_date, end_date, payment_id)
//        VALUES (?, ?, ?, ?, ?)`,
//       [userId, planId, startDate, endDate, payment.id],
//     );
//   }

//   res.json({ status: "ok" });
// };
