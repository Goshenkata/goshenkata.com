export function authorizeUser(event) {
  const allowedEmail = process.env.ALLOWED_USER_EMAIL;
  const claims = event.requestContext?.authorizer?.claims;
  return !!(claims && claims.email === allowedEmail);
}
