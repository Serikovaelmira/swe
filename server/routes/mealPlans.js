const express = require("express");
const db = require("../database");
const { authMiddleware } = require("../middleware/auth");
const router = express.Router();
const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const SLOTS = ["breakfast", "lunch", "dinner"];

router.get("/", authMiddleware, (req, res) => {
  const plans = db.prepare(`SELECT mp.id, mp.day, mp.slot, mp.recipe_id, r.title, r.tag, r.meal_slots, r.servings,
    r.calories AS total_recipe_calories,
    CASE WHEN r.calories > 0 THEN CAST(ROUND(1.0 * r.calories / MAX(r.servings, 1)) AS INTEGER) ELSE 0 END AS calories
    FROM meal_plans mp JOIN recipes r ON r.id = mp.recipe_id
    WHERE mp.user_id = ?
    ORDER BY CASE mp.day WHEN 'monday' THEN 1 WHEN 'tuesday' THEN 2 WHEN 'wednesday' THEN 3 WHEN 'thursday' THEN 4 WHEN 'friday' THEN 5 WHEN 'saturday' THEN 6 WHEN 'sunday' THEN 7 END,
    CASE mp.slot WHEN 'breakfast' THEN 1 WHEN 'lunch' THEN 2 WHEN 'dinner' THEN 3 END`).all(req.user.id);
  res.json(plans);
});

router.post("/", authMiddleware, (req, res) => {
  const { recipe_id, day, slot } = req.body;
  if (!recipe_id || !day || !slot) return res.status(400).json({ error: "recipe_id, day, and slot are required" });
  if (!DAYS.includes(day)) return res.status(400).json({ error: "Day must be a weekday" });
  if (!SLOTS.includes(slot)) return res.status(400).json({ error: "Slot must be breakfast, lunch, or dinner" });
  const recipe = db.prepare("SELECT id, tag, meal_slots FROM recipes WHERE id = ? AND user_id = ?").get(recipe_id, req.user.id);
  if (!recipe) return res.status(404).json({ error: "Recipe not found" });
  let allowedSlots = [];
  try { allowedSlots = JSON.parse(recipe.meal_slots || "[]"); } catch { allowedSlots = []; }
  if (!Array.isArray(allowedSlots) || allowedSlots.length === 0) allowedSlots = [recipe.tag];
  if (!allowedSlots.includes(slot)) return res.status(400).json({ error: `This recipe is not marked for ${slot}. Edit its meal slots first.` });
  db.prepare(`INSERT INTO meal_plans (user_id, recipe_id, day, slot) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, day, slot) DO UPDATE SET recipe_id = excluded.recipe_id`).run(req.user.id, recipe_id, day, slot);
  res.status(201).json({ message: "Meal plan updated" });
});

router.delete("/:id", authMiddleware, (req, res) => {
  const result = db.prepare("DELETE FROM meal_plans WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id);
  if (!result.changes) return res.status(404).json({ error: "Entry not found" });
  res.json({ message: "Entry removed" });
});
router.delete("/", authMiddleware, (req, res) => {
  db.prepare("DELETE FROM meal_plans WHERE user_id = ?").run(req.user.id);
  res.json({ message: "Meal plan cleared" });
});
module.exports = router;
