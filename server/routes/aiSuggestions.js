const express = require("express");
const db = require("../database");
const { authMiddleware } = require("../middleware/auth");
const { askGeminiJson } = require("../gemini");

const router = express.Router();

function cleanRecipe(r) {
  return {
    title: String(r.title || "").trim(),
    description: String(r.description || ""),
    tag: ["breakfast", "lunch", "dinner"].includes(r.tag) ? r.tag : "lunch",
    servings: Math.max(1, Math.round(Number(r.servings) || 2)),
    ingredients: Array.isArray(r.ingredients)
      ? r.ingredients
          .filter((i) => i && i.name)
          .map((i) => ({ name: String(i.name), quantity: Number(i.quantity) || 0, unit: String(i.unit || "g") }))
      : [],
    steps: Array.isArray(r.steps) ? r.steps.map(String) : [],
  };
}

router.post("/", authMiddleware, async (req, res) => {
  const ingredients = req.body?.ingredients;
  if (!Array.isArray(ingredients) || !ingredients.length || ingredients.some((x) => typeof x !== "string" || !x.trim())) {
    return res.status(400).json({ error: "Enter one or more ingredient names." });
  }

  try {
    const user = db.prepare("SELECT dietary_preferences FROM users WHERE id = ?").get(req.user.id);
    const dietaryNote = user?.dietary_preferences ? `Dietary preferences: ${user.dietary_preferences}.` : "";
    const system = `Suggest exactly 3 practical recipes that use the supplied ingredients. ${dietaryNote} Return a JSON object {"recipes": [...]} where each recipe has: title (string), description (string), tag ("breakfast", "lunch" or "dinner"), servings (positive integer), ingredients (array of {name, quantity, unit}), steps (array of strings). Return nothing outside the JSON.`;
    const prompt = `Available ingredients: ${ingredients.map((x) => x.trim()).join(", ")}`;

    const parsed = await askGeminiJson(system, prompt);
    if (!Array.isArray(parsed.recipes) || parsed.recipes.length === 0) {
      return res.status(502).json({ error: "Gemini не вернул рецепты. Попробуйте другие ингредиенты." });
    }
    return res.json(parsed.recipes.slice(0, 3).map(cleanRecipe));
  } catch (err) {
    console.error("AI suggestions error:", err.status || "n/a", err.message);
    if (err.status === 503) return res.status(503).json({ error: err.message });
    if (err.status === 400 || err.status === 401 || err.status === 403) {
      return res.status(502).json({ error: "Gemini отклонил ключ или запрос. Проверьте GEMINI_API_KEY в корневом .env и перезапустите сервер." });
    }
    if (err.status === 429) {
      return res.status(502).json({ error: "Лимит бесплатного Gemini исчерпан. Подождите немного и попробуйте снова." });
    }
    return res.status(502).json({ error: `AI-подсказки не получены: ${err.message}` });
  }
});

module.exports = router;

