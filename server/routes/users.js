const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../database");
const { generateToken, authMiddleware } = require("../middleware/auth");
const router = express.Router();

router.post("/register", (req, res) => {
  const { email, password, name } = req.body;
  if (typeof email !== "string" || !email.trim() || typeof password !== "string" || password.length < 8 || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "Name, valid email, and a password of at least 8 characters are required" });
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(normalizedEmail)) {
    return res.status(409).json({ error: "Email already registered" });
  }
  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare("INSERT INTO users (email, password, name) VALUES (?, ?, ?)").run(normalizedEmail, hash, name.trim());
  const user = db.prepare("SELECT id, email, name FROM users WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ user, token: generateToken(user) });
});

router.post("/login", (req, res) => {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: "Invalid credentials" });
  const { password: _password, ...safe } = user;
  res.json({ user: safe, token: generateToken(user) });
});

const PROFILE_SELECT = "SELECT id, email, name, dietary_preferences, calorie_goal, sex, weight_kg, height_cm, goal FROM users WHERE id = ?";
router.get("/me", authMiddleware, (req, res) => {
  const user = db.prepare(PROFILE_SELECT).get(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

router.put("/me", authMiddleware, (req, res) => {
  const { name, dietary_preferences, calorie_goal, sex, weight_kg, height_cm, goal } = req.body;
  if (name !== undefined && (typeof name !== "string" || !name.trim())) return res.status(400).json({ error: "Name cannot be empty" });
  if (dietary_preferences !== undefined && typeof dietary_preferences !== "string") return res.status(400).json({ error: "Dietary preferences must be text" });
  if (calorie_goal !== undefined && (!Number.isInteger(Number(calorie_goal)) || Number(calorie_goal) < 500 || Number(calorie_goal) > 5000)) return res.status(400).json({ error: "Calorie goal must be an integer from 500 to 5000" });
  if (sex !== undefined && !["female", "male", ""].includes(sex)) return res.status(400).json({ error: "Sex must be female or male" });
  if (weight_kg !== undefined && weight_kg !== null && (!Number.isFinite(Number(weight_kg)) || Number(weight_kg) < 20 || Number(weight_kg) > 350)) return res.status(400).json({ error: "Weight must be between 20 and 350 kg" });
  if (height_cm !== undefined && height_cm !== null && (!Number.isFinite(Number(height_cm)) || Number(height_cm) < 100 || Number(height_cm) > 250)) return res.status(400).json({ error: "Height must be between 100 and 250 cm" });
  if (goal !== undefined && !["lose", "gain_muscle", "maintain"].includes(goal)) return res.status(400).json({ error: "Choose lose, gain_muscle, or maintain as the goal" });

  db.prepare(`UPDATE users SET
    name = COALESCE(?, name),
    dietary_preferences = COALESCE(?, dietary_preferences),
    calorie_goal = COALESCE(?, calorie_goal),
    sex = COALESCE(?, sex),
    weight_kg = COALESCE(?, weight_kg),
    height_cm = COALESCE(?, height_cm),
    goal = COALESCE(?, goal)
    WHERE id = ?`).run(
      name === undefined ? null : name.trim(),
      dietary_preferences === undefined ? null : dietary_preferences,
      calorie_goal === undefined ? null : Number(calorie_goal),
      sex === undefined ? null : sex,
      weight_kg === undefined || weight_kg === null ? null : Number(weight_kg),
      height_cm === undefined || height_cm === null ? null : Number(height_cm),
      goal === undefined ? null : goal,
      req.user.id
    );
  res.json(db.prepare(PROFILE_SELECT).get(req.user.id));
});
module.exports = router;