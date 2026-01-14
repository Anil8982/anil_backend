// const axios = require("axios");

// exports.sendSMS = async (mobile, message) => {
//   try {
//     await axios.post(
//       "https://api.msg91.com/api/v5/flow/",
//       {
//         flow_id: "YOUR_FLOW_ID", // from MSG91 dashboard
//         sender: process.env.MSG91_SENDER_ID,
//         mobiles: "91" + mobile,
//         message: message,
//       },
//       {
//         headers: {
//           authkey: process.env.MSG91_AUTH_KEY,
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     console.log("📱 SMS sent to", mobile);
//   } catch (err) {
//     console.error("❌ SMS failed:", err.message);
//   }
// };



// MSG91 SMS INTEGRATION (INDIA – REAL SMS)
// 🔹 STEP 1: MSG91 Account

// Go to MSG91

// Create account

// Get:

// AUTH KEY

// Sender ID (6 letters, eg: YODOCT)

// Enable Transactional SMS

// 🔹 STEP 2: Install axios
// npm install axios

// 🔹 STEP 3: ENV VARIABLES

// .env

// MSG91_AUTH_KEY=xxxxxxxxxxxxxxxx
// MSG91_SENDER_ID=YODOCT

// 🔹 STEP 4: SMS UTILITY

// 📁 utils/sms.js

// const axios = require("axios");

// exports.sendSMS = async (mobile, message) => {
//   try {
//     await axios.post(
//       "https://api.msg91.com/api/v5/flow/",
//       {
//         flow_id: "YOUR_FLOW_ID", // from MSG91 dashboard
//         sender: process.env.MSG91_SENDER_ID,
//         mobiles: "91" + mobile,
//         message: message,
//       },
//       {
//         headers: {
//           authkey: process.env.MSG91_AUTH_KEY,
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     console.log("📱 SMS sent to", mobile);
//   } catch (err) {
//     console.error("❌ SMS failed:", err.message);
//   }
// };


// 📌 Note: MSG91 works best with FLOW ID (template-based).
// Agar chaho, main template bhi bana deta hoon.