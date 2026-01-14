// utils/notification.js

exports.sendEmail = async (to, subject, message) => {
  // Abhi dummy (console)
  console.log("📧 EMAIL SENT");
  console.log("To:", to);
  console.log("Subject:", subject);
  console.log("Message:", message);
};

exports.sendSMS = async (mobile, message) => {
  // Abhi dummy (console)
  console.log("📱 SMS SENT");
  console.log("To:", mobile);
  console.log("Message:", message);
};
