module.exports = ({ patientName, doctorName, appointmentTime }) => `
<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif;">
    <h2>Appointment Confirmed</h2>
    <p>Hello ${patientName},</p>
    <p>Your appointment with Dr. ${doctorName} has been confirmed.</p>
    <p><strong>Date & Time:</strong> ${appointmentTime}</p>
    <br />
    <p>Regards,<br/>Healthcare Team</p>
  </body>
</html>
`;
