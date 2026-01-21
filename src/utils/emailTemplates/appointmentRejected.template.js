module.exports = ({ patientName, doctorName }) => `
<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif;">
    <h2>Appointment Rejected</h2>
    <p>Hello ${patientName},</p>
    <p>Your appointment request with Dr. ${doctorName} has been rejected.</p>
    <p>Please try booking another slot.</p>
    <br />
    <p>Regards,<br/>Healthcare Team</p>
  </body>
</html>
`;
