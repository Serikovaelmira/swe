const jwt = require("jsonwebtoken");

// Verifies a bearer token against the secret and returns its payload, or null if invalid/expired.
function verifyToken(token, secret) {
  if (!token || !secret) return null;
  try {
    return jwt.verify(token, secret, { algorithms: ["HS256"] });
  } catch {
    return null;
  }
}

module.exports = { verifyToken };
