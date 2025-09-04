export default function attachAuthHeader(req, _res, next) {
  if (req.session && req.session.idToken) {
    req.isAuthenticated = true;
    req.authHeaders = { Authorization: req.session.idToken };
  } else {
    req.authHeaders = {};
  }
  next();
}
