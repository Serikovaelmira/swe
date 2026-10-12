const express = require("express");
const db = require("../database");
const { authMiddleware } = require("../middleware/auth");
const { VALID_SLOTS, validateRecipe, parseManualCalories } = require("../lib/validation");

const router = express.Router();

// Normalizes meal slots: prefers the meal_slots JSON array, falls back to the legacy tag.
function normalizeRecipe(recipe) {
  let mealSlots = [];
  try { mealSlots = JSON.parse(recipe.meal_slots || "[]"); } catch { mealSlots = []; }
  if (!Array.isArray(mealSlots) || mealSlots.length === 0) mealSlots = recipe.tag ? [recipe.tag] : [];
  return { ...recipe, meal_slots: [...new Set(mealSlots.filter((slot) => VALID_SLOTS.includes(slot)))] };
}

function attachIngredients(recipes) {
  const stmt = db.prepare("SELECT * FROM recipe_ingredients WHERE recipe_id = ?");
  return recipes.map((recipe) => ({ ...normalizeRecipe(recipe), ingredients: stmt.all(recipe.id) }));
}

router.get("/", authMiddleware, (req, res) => {
  const { search, tag } = req.query;
  let query = "SELECT * FROM recipes WHERE user_id = ?";
  const params = [req.user.id];
  if (search) { query += " AND title LIKE ?"; params.push(`%${search}%`); }
  if (tag && VALID_SLOTS.includes(tag)) { query += " AND (tag = ? OR instr(meal_slots, ?) > 0)"; params.push(tag, `"${tag}"`); }
  query += " ORDER BY created_at DESC";
  res.json(attachIngredients(db.prepare(query).all(...params)));
});

router.get("/:id", authMiddleware, (req, res) => {
  const recipe = db.prepare("SELECT * FROM recipes WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id);
  if (!recipe) return res.status(404).json({ error: "Recipe not found" });
  res.json(attachIngredients([recipe])[0]);
});

router.post("/", authMiddleware, (req, res) => {
  const validationError = validateRecipe(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  const { title, description = "", steps = "", servings = 2, ingredients } = req.body;
  const slots = [...new Set(req.body.meal_slots || [req.body.tag])];
  const tag = slots[0];
  // A missing manual calorie value is stored as 0 ("not calculated yet").
  const calories = parseManualCalories(req.body.calories) ?? 0;

  const create = db.transaction(() => {
    const result = db.prepare(
      "INSERT INTO recipes (user_id, title, description, steps, tag, meal_slots, servings, calories) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(req.user.id, title.trim(), description, steps, tag, JSON.stringify(slots), Number(servings), calories);

    const insert = db.prepare("INSERT INTO recipe_ingredients (recipe_id, name, quantity, unit) VALUES (?, ?, ?, ?)");
    for (const item of ingredients) {
      insert.run(result.lastInsertRowid, item.name.trim(), Number(item.quantity), item.unit.trim());
    }
    return result.lastInsertRowid;
  });

  const id = create();
  res.status(201).json(attachIngredients([db.prepare("SELECT * FROM recipes WHERE id = ?").get(id)])[0]);
});

router.put("/:id", authMiddleware, (req, res) => {
  const existing = db.prepare("SELECT * FROM recipes WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: "Recipe not found" });

  const touchesValidatedFields =
    req.body.ingredients !== undefined || req.body.meal_slots !== undefined ||
    req.body.tag !== undefined || req.body.title !== undefined;
  if (touchesValidatedFields) {
    const validationError = validateRecipe({
      ...normalizeRecipe(existing),
      ...req.body,
      ingredients: req.body.ingredients ?? db.prepare("SELECT * FROM recipe_ingredients WHERE recipe_id = ?").all(existing.id),
    });
    if (validationError) return res.status(400).json({ error: validationError });
  }

  const { title, description, steps, servings } = req.body;
  const slots = req.body.meal_slots
    ? [...new Set(req.body.meal_slots)]
    : (req.body.tag ? [req.body.tag] : normalizeRecipe(existing).meal_slots);
  // Empty calories keep the stored value (COALESCE with null).
  const calories = parseManualCalories(req.body.calories);

  const update = db.transaction(() => {
    db.prepare(
      "UPDATE recipes SET title = COALESCE(?, title), description = COALESCE(?, description), steps = COALESCE(?, steps), tag = ?, meal_slots = ?, servings = COALESCE(?, servings), calories = COALESCE(?, calories) WHERE id = ?"
    ).run(
      title === undefined ? null : title.trim(),
      description ?? null,
      steps ?? null,
      slots[0],
      JSON.stringify(slots),
      servings ?? null,
      calories,
      existing.id
    );

    if (req.body.ingredients !== undefined) {
      db.prepare("DELETE FROM recipe_ingredients WHERE recipe_id = ?").run(existing.id);
      const insert = db.prepare("INSERT INTO recipe_ingredients (recipe_id, name, quantity, unit) VALUES (?, ?, ?, ?)");
      for (const item of req.body.ingredients) {
        insert.run(existing.id, item.name.trim(), Number(item.quantity), item.unit.trim());
      }
    }
  });
  update();

  res.json(attachIngredients([db.prepare("SELECT * FROM recipes WHERE id = ?").get(existing.id)])[0]);
});

router.delete("/:id", authMiddleware, (req, res) => {
  const existing = db.prepare("SELECT id FROM recipes WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: "Recipe not found" });
  db.prepare("DELETE FROM recipes WHERE id = ?").run(existing.id);
  res.json({ message: "Recipe deleted" });
});

module.exports = router;
