const express = require("express");
const db = require("../database");
const { authMiddleware } = require("../middleware/auth");
const { askGeminiJson } = require("../gemini");

const router = express.Router();

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

router.post("/:recipeId", authMiddleware, async (req, res) => {
  const recipe = db.prepare("SELECT * FROM recipes WHERE id = ? AND user_id = ?").get(req.params.recipeId, req.user.id);
  if (!recipe) return res.status(404).json({ error: "Recipe not found." });

  const ingredients = db.prepare("SELECT name, quantity, unit FROM recipe_ingredients WHERE recipe_id = ?").all(recipe.id);
  if (!ingredients.length) return res.status(400).json({ error: "Add ingredients before calculating nutrition." });

  const servings = Math.max(1, Number(recipe.servings) || 1);

  try {
    const system = 'Estimate the nutrition of the WHOLE recipe from the listed ingredient quantities. Return only JSON: {"total_calories": number, "total_protein_g": number, "total_carbs_g": number, "total_fat_g": number}. Use plain numbers, no units. These are approximate estimates.';
    const estimate = await askGeminiJson(system, JSON.stringify({ title: recipe.title, servings, ingredients }));

    const totalCalories = num(estimate.total_calories ?? estimate.calories);
    if (totalCalories <= 0) throw Object.assign(new Error("модель не вернула значение калорий"), { status: 502 });

    const perServing = {
      calories: Math.round(totalCalories / servings),
      protein: Math.round((num(estimate.total_protein_g ?? estimate.protein_g) / servings) * 10) / 10,
      carbs: Math.round((num(estimate.total_carbs_g ?? estimate.carbs_g) / servings) * 10) / 10,
      fat: Math.round((num(estimate.total_fat_g ?? estimate.fat_g) / servings) * 10) / 10,
    };

    db.prepare("UPDATE recipes SET calories = ?, protein = ?, carbs = ?, fat = ? WHERE id = ? AND user_id = ?")
      .run(perServing.calories, perServing.protein, perServing.carbs, perServing.fat, recipe.id, req.user.id);

    return res.json({
      ...perServing,
      calories_per_serving: perServing.calories,
      total_recipe_calories: Math.round(totalCalories),
      servings,
      estimated: true,
      basis: "per serving",
    });
  } catch (err) {
    console.error("Nutrition estimate error:", err.status || "n/a", err.message);
    if (err.status === 503) return res.status(503).json({ error: err.message });
    if (err.status === 400 || err.status === 401 || err.status === 403) {
      return res.status(502).json({ error: "Gemini отклонил ключ или запрос. Проверьте GEMINI_API_KEY." });
    }
    if (err.status === 429) {
      return res.status(502).json({ error: "Лимит бесплатного Gemini исчерпан. Рецепт сохранён; повторите расчёт позже или введите kcal вручную." });
    }
    return res.status(502).json({ error: `Не удалось оценить калории: ${err.message}. Рецепт сохранён.` });
  }
});

module.exports = router;
