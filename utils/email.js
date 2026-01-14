const nodemailer = require("nodemailer");

const sendEmail = async (to, subject, html) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"YoDoctor" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log("✅ Email sent to:", to);
  } catch (error) {
    console.error("❌ Email send failed:", error.message);
    throw error;
  }
};

module.exports = { sendEmail };

// 📧 NODEMAILER EMAIL SETUP (GMAIL / SMTP)
// 🔹 STEP 1: Install nodemailer
// npm install nodemailer

// 🔹 STEP 2: Gmail App Password

// Google Account → Security

// Enable 2-step verification

// Create App Password

// Copy password

// 🔹 STEP 3: ENV VARIABLES

// .env

// EMAIL_USER=yourgmail@gmail.com
// EMAIL_PASS=your_app_password

// 🔹 STEP 4: EMAIL UTILITY

// 📁 utils/email.js

// const nodemailer = require("nodemailer");

// const transporter = nodemailer.createTransport({
//   service: "gmail",
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS,
//   },
// });

// exports.sendEmail = async (to, subject, html) => {
//   try {
//     await transporter.sendMail({
//       from: `"YoDoctor" <${process.env.EMAIL_USER}>`,
//       to,
//       subject,
//       html,
//     });

//     console.log("📧 Email sent to", to);
//   } catch (err) {
//     console.error("❌ Email failed:", err.message);
//   }
// };
