const VALID_SLOTS = ["breakfast", "lunch", "dinner"];

// Returns an error message string, or null when the recipe payload is valid.
function validateRecipe(body) {
  if (!body || typeof body !== "object") return "Request body must be a JSON object";
  const { title, ingredients, servings, meal_slots, tag } = body;
  if (typeof title !== "string" || !title.trim()) return "Recipe title is required";
  if (title.trim().length > 120) return "Recipe title must be 120 characters or fewer";
  if (!Array.isArray(ingredients) || ingredients.length === 0) return "At least one ingredient is required";
  const slots = Array.isArray(meal_slots) ? meal_slots : (tag ? [tag] : []);
  if (slots.length === 0 || slots.some((slot) => !VALID_SLOTS.includes(slot))) return "Choose one or more valid meal slots";
  if (servings !== undefined && (!Number.isInteger(Number(servings)) || Number(servings) < 1 || Number(servings) > 100)) {
    return "Servings must be between 1 and 100";
  }
  const badIngredient = ingredients.some((item) =>
    !item || typeof item.name !== "string" || !item.name.trim() ||
    !Number.isFinite(Number(item.quantity)) || Number(item.quantity) < 0 ||
    typeof item.unit !== "string" || !item.unit.trim());
  if (badIngredient) return "Each ingredient needs a name, non-negative quantity, and unit";
  return null;
}

// Manual calories per serving: empty means "not provided"; otherwise a non-negative integer.
function parseManualCalories(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

module.exports = { VALID_SLOTS, validateRecipe, parseManualCalories };
