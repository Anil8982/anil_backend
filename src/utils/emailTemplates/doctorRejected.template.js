module.exports = ({ doctorName }) => `
<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif;">
    <h2>Account Rejected</h2>
    <p>Hello Dr. ${doctorName},</p>
    <p>Your account has been rejected by the admin.</p>
    <p>Please contact support for further clarification.</p>
    <br />
    <p>Regards,<br/>Healthcare Team</p>
  </body>
</html>
`;
