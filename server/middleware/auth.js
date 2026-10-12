const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "meal-planner-secret-key";

function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, SECRET, {
    expiresIn: "7d",
  });
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }
  try {
    const decoded = jwt.verify(header.split(" ")[1], SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

module.exports = { generateToken, authMiddleware };
