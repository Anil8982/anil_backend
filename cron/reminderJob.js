// const db = require("../src/config/db.js");
// const { sendEmail } = require("../utils/emailService.js");
// const { sendWhatsApp } = require("../utils/whatsappService.js");

// setInterval(async () => {
//   try {
//     const [reminders] = await db.query(
//       `SELECT
//          r.id,
//          r.reminder_type,
//          u.email AS email,
//          u.mobile,
//          a.id AS appointment_id
//        FROM reminders r
//        JOIN appointments a ON a.id = r.appointment_id
//        JOIN users u ON u.id = a.patient_id
//        WHERE r.sent = FALSE
//        AND r.scheduled_at <= NOW()
//        AND a.status IN ('PENDING','ACCEPTED')`
//     );

//     for (const r of reminders) {
//       let message = "Appointment reminder";

//       if (r.reminder_type === "DAY_BEFORE")
//         message = "Reminder: You have an appointment tomorrow.";
//       else if (r.reminder_type === "SAME_DAY")
//         message = "Reminder: You have an appointment today.";
//       else if (r.reminder_type === "FOLLOW_UP")
//         message = "Doctor suggested a follow-up. Please book.";

//       await sendEmail({
//         to: r.email,
//         subject: "Appointment Reminder",
//         text: message,
//       });

//       if (r.phone) {
//         await sendWhatsApp({
//           phone: r.phone,
//           message,
//         });
//       }

//       await db.query(`UPDATE reminders SET sent = TRUE WHERE id = ?`, [r.id]);
//     }
//   } catch (err) {
//     console.error("Reminder cron error:", err.message);
//   }
// }, 60 * 1000);
