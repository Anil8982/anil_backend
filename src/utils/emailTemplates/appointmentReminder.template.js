module.exports = ({ patientName }) => `
<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif;">
    <h2>Appointment Reminder</h2>
    <p>Hello ${patientName},</p>
    <p>Your appointment token will be called shortly.</p>
    <p>Please be available at the clinic/app.</p>
    <br />
    <p>Regards,<br/>Healthcare Team</p>
  </body>
</html>
`;
