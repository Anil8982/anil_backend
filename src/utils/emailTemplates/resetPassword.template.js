module.exports = (resetLink) => `
<!DOCTYPE html>
<html>
<body>
  <h2>Reset your password</h2>
  <p>Click the link below to reset your password:</p>
  <a href="${resetLink}">Reset Password</a>
  <p>This link is valid for 15 minutes.</p>
</body>
</html>
`;
