const sendWhatsApp = async (mobile, message) => {
  try {
    console.log("📲 WhatsApp message");
    console.log("To:", mobile);
    console.log("Message:", message);
    return true;
  } catch (error) {
    console.error("❌ WhatsApp send failed:", error.message);
    throw error;
  }
};

module.exports = { sendWhatsApp };

// const twilio = require("twilio");

// const client = twilio(
//   process.env.TWILIO_SID,
//   process.env.TWILIO_AUTH_TOKEN
// );

// exports.sendWhatsApp = async (mobile, message) => {
//   try {
//     await client.messages.create({
//       from: process.env.TWILIO_WHATSAPP_FROM,
//       to: `whatsapp:+91${mobile}`,
//       body: message,
//     });

//     console.log("💬 WhatsApp sent to", mobile);
//     return true;
//   } catch (err) {
//     console.error("❌ WhatsApp failed:", err.message);
//     return false;
//   }
// };

// FINAL: APPROVE DOCTOR (SMS + EMAIL + WHATSAPP)
// const { sendSMS } = require("../utils/sms");
// const { sendEmail } = require("../utils/email");
// const { sendWhatsApp } = require("../utils/whatsapp");
// const { logNotification } = require("../utils/notificationLogger");

// exports.approveDoctor = async (req, res) => {
//   const userId = req.params.id;

//   const [[doctor]] = await db.query(
//     `SELECT d.doctorName, u.email, u.mobile
//      FROM doctors d
//      JOIN users u ON u.id = d.user_id
//      WHERE d.user_id = ?`,
//     [userId]
//   );

//   if (!doctor) {
//     return res.status(404).json({ message: "Doctor not found" });
//   }

//   await db.query(`UPDATE doctors SET status='APPROVED' WHERE user_id=?`, [
//     userId,
//   ]);

//   const msg =
//     `🎉 *YoDoctor Update*\n\nHello Dr. ${doctor.doctorName},\n\n` +
//     `Your profile has been *APPROVED* ✅\n` +
//     `You can now login and start consulting patients.\n\n` +
//     `– YoDoctor Team`;

//   // SMS
//   await sendSMS(doctor.mobile, msg);
//   await logNotification({
//     userId,
//     role: "DOCTOR",
//     type: "APPROVED",
//     channel: "SMS",
//     message: msg,
//   });

//   // Email
//   await sendEmail(
//     doctor.email,
//     "Doctor Profile Approved",
//     `<p>${msg.replace(/\n/g, "<br>")}</p>`
//   );
//   await logNotification({
//     userId,
//     role: "DOCTOR",
//     type: "APPROVED",
//     channel: "EMAIL",
//     message: msg,
//   });

//   // WhatsApp 💬
//   const waStatus = await sendWhatsApp(doctor.mobile, msg);
//   await logNotification({
//     userId,
//     role: "DOCTOR",
//     type: "APPROVED",
//     channel: "WHATSAPP",
//     message: msg,
//     status: waStatus ? "SENT" : "FAILED",
//   });

//   res.json({ message: "Doctor approved & notified (SMS + Email + WhatsApp)" });
// };

// ❌ REJECT DOCTOR (WHATSAPP INCLUDED)
// const msg =
//   `❌ *YoDoctor Update*\n\nHello Dr. ${doctor.doctorName},\n\n` +
//   `We are sorry to inform you that your profile has been *REJECTED*.\n` +
//   `Please contact support for more details.\n\n` +
//   `– YoDoctor Team`;
