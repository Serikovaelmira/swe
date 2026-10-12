const express = require("express");
const db = require("../database");
const { authMiddleware } = require("../middleware/auth");
const { buildPlan, DAYS } = require("../lib/planner");

const router = express.Router();

router.post("/", authMiddleware, (req, res) => {
  const user = db.prepare("SELECT calorie_goal FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found." });
  const target = Number(user.calorie_goal);
  if (!Number.isFinite(target) || target < 500) {
    return res.status(400).json({ error: "Set a valid daily calorie goal in Profile first." });
  }

  const recipes = db.prepare("SELECT * FROM recipes WHERE user_id = ?").all(req.user.id);
  const result = buildPlan({ recipes, target });
  if (result.error) return res.status(400).json({ error: result.error });

  const clear = db.prepare("DELETE FROM meal_plans WHERE user_id = ?");
  const insert = db.prepare("INSERT INTO meal_plans (user_id, recipe_id, day, slot) VALUES (?, ?, ?, ?)");
  db.transaction(() => {
    clear.run(req.user.id);
    for (const x of result.plan) insert.run(req.user.id, x.recipe_id, x.day, x.slot);
  })();

  res.json({
    message: "Meal plan generated",
    plan: result.plan,
    total_weekly_calories: Math.round(result.total),
    target_daily_calories: target,
    target_weekly_calories: target * DAYS.length,
    actual_average_daily_calories: Math.round(result.total / DAYS.length),
    calories_basis: "per serving",
    estimated: true,
  });
});

module.exports = router;
