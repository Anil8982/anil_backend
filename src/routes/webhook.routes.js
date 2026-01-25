// // routes/webhook.routes.js
// const express = require("express")
// const router = express.Router()
// const { razorpayWebhook } = require("../webhooks/razorpay.webhook")

// router.post(
//   "/razorpay",
//   express.json({ verify: (req, res, buf) => { req.rawBody = buf } }),
//   razorpayWebhook
// )

// module.exports = router
