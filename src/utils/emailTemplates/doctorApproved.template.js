module.exports = ({ doctorName }) => `
<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif;">
    <h2>Account Approved</h2>
    <p>Hello Dr. ${doctorName},</p>
    <p>Your account has been approved by the admin.</p>
    <p>You can now start receiving patient appointments.</p>
    <br />
    <p>Regards,<br/>Healthcare Team</p>
  </body>
</html>
`;
