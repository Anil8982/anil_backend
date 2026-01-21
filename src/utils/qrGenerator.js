const QRCode = require("qrcode");

exports.generateDoctorQR = async (doctorId) => {
  const qrPayload = JSON.stringify({
    doctorId,
    type: "QR_BOOK",
  });

  const qrImage = await QRCode.toDataURL(qrPayload);
  return qrImage;
};
