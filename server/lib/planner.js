const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const SLOTS = ["breakfast", "lunch", "dinner"];

// Recipe slots: the meal_slots field, or the single legacy tag for old records.
function recipeSlots(recipe) {
  if (Array.isArray(recipe.meal_slots) && recipe.meal_slots.length) return recipe.meal_slots;
  if (typeof recipe.meal_slots === "string" && recipe.meal_slots) {
    try {
      const parsed = JSON.parse(recipe.meal_slots);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch { /* legacy data */ }
  }
  return recipe.tag ? [recipe.tag] : [];
}

function isValidSlotList(slots) {
  return Array.isArray(slots) && slots.length > 0 && slots.every((s) => SLOTS.includes(s));
}

// Builds a weekly plan with one recipe per slot per day.
// Returns { error } when data is missing, otherwise { plan, total }.
function buildPlan({ recipes, target, days = DAYS }) {
  const candidates = recipes.filter((r) => Number.isFinite(Number(r.calories)) && Number(r.calories) > 0);
  const bySlot = Object.fromEntries(SLOTS.map((slot) => [slot, candidates.filter((r) => recipeSlots(r).includes(slot))]));
  const missing = SLOTS.filter((slot) => bySlot[slot].length === 0);
  if (missing.length) {
    return { error: `Cannot generate a calorie-aware plan. Add recipes tagged for: ${missing.join(", ")}, and calculate their nutrition first.` };
  }

  const used = [];
  const plan = [];
  for (const day of days) {
    let best = null;
    for (const b of bySlot.breakfast) for (const l of bySlot.lunch) for (const d of bySlot.dinner) {
      const meals = [b, l, d];
      const total = meals.reduce((sum, r) => sum + Number(r.calories), 0);
      const repeats = meals.reduce((sum, r) => sum + used.filter((id) => id === r.id).length, 0);
      const score = Math.abs(total - target) / target + repeats * 0.025;
      if (!best || score < best.score) best = { meals, score };
    }
    SLOTS.forEach((slot, i) => {
      const recipe = best.meals[i];
      plan.push({ day, slot, recipe_id: recipe.id, title: recipe.title, calories: Number(recipe.calories) });
      used.push(recipe.id);
    });
  }
  const total = plan.reduce((sum, x) => sum + x.calories, 0);
  return { plan, total };
}

module.exports = { DAYS, SLOTS, recipeSlots, isValidSlotList, buildPlan };
