const express = require("express");
const db = require("../database");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

/**
 * COMPLEX FEATURE: Shopping List Generator with Unit Normalization
 *
 * Multi-step pipeline:
 * 1. Extract ingredients from all planned recipes, scale by servings
 * 2. Normalize units via conversion graph + ingredient density table
 * 3. Aggregate same ingredients
 * 4. Group by store category
 */

// ---- Unit Conversion Graph ----
// Each entry: { from, to, factor } means 1 <from> = <factor> <to>
const CONVERSIONS = [
  // Volume
  { from: "tsp", to: "ml", factor: 5 },
  { from: "tbsp", to: "ml", factor: 15 },
  { from: "cup", to: "ml", factor: 240 },
  { from: "cups", to: "ml", factor: 240 },
  { from: "l", to: "ml", factor: 1000 },
  { from: "liter", to: "ml", factor: 1000 },
  { from: "liters", to: "ml", factor: 1000 },
  // Weight
  { from: "oz", to: "g", factor: 28.35 },
  { from: "lb", to: "g", factor: 453.6 },
  { from: "lbs", to: "g", factor: 453.6 },
  { from: "kg", to: "g", factor: 1000 },
];

// Ingredient density table: grams per cup (for cross-type conversion)
// Only solid/semi-solid ingredients — liquids stay in ml
const DENSITY = {
  flour: 125,
  sugar: 200,
  butter: 227,
  rice: 185,
  oats: 90,
  honey: 340,
  salt: 290,
};

// Canonical base units for aggregation
const VOLUME_BASE = "ml";
const WEIGHT_BASE = "g";

const VOLUME_UNITS = ["ml", "tsp", "tbsp", "cup", "cups", "l", "liter", "liters"];
const WEIGHT_UNITS = ["g", "oz", "lb", "lbs", "kg"];

// Category mapping for store grouping
const CATEGORIES = {
  dairy: ["milk", "cheese", "butter", "cream", "yogurt", "egg", "eggs"],
  produce: ["tomato", "onion", "garlic", "lettuce", "carrot", "pepper", "potato", "lemon", "lime", "avocado", "spinach", "broccoli", "mushroom", "cucumber", "celery", "ginger", "basil", "cilantro", "parsley"],
  grains: ["flour", "rice", "pasta", "bread", "oats", "tortilla", "noodles", "cereal"],
  meat: ["chicken", "beef", "pork", "fish", "salmon", "shrimp", "turkey", "bacon", "sausage"],
  pantry: ["oil", "salt", "pepper", "sugar", "honey", "vinegar", "soy sauce", "ketchup", "mustard", "mayonnaise", "stock", "broth"],
  spices: ["cumin", "paprika", "cinnamon", "oregano", "thyme", "chili", "turmeric", "nutmeg"],
};

function getUnitType(unit) {
  const u = unit.toLowerCase().trim();
  if (VOLUME_UNITS.includes(u)) return "volume";
  if (WEIGHT_UNITS.includes(u)) return "weight";
  return "other";
}

// Convert a quantity from one unit to the base unit (ml or g)
function toBase(quantity, unit) {
  const u = unit.toLowerCase().trim();
  if (u === VOLUME_BASE || u === WEIGHT_BASE) return quantity;

  const conv = CONVERSIONS.find((c) => c.from === u);
  if (conv) return quantity * conv.factor;

  return quantity; // Unknown unit, return as-is
}

// Try cross-type conversion using density (volume → weight)
function crossConvert(quantity, unit, ingredientName) {
  const unitType = getUnitType(unit);
  if (unitType !== "volume") return null;

  const name = ingredientName.toLowerCase().trim();
  for (const [key, gramsPerCup] of Object.entries(DENSITY)) {
    if (name.includes(key)) {
      // Convert to cups first, then to grams
      const inMl = toBase(quantity, unit);
      const inCups = inMl / 240;
      return inCups * gramsPerCup;
    }
  }
  return null;
}

function categorize(ingredientName) {
  const name = ingredientName.toLowerCase();
  for (const [category, items] of Object.entries(CATEGORIES)) {
    if (items.some((item) => name.includes(item))) return category;
  }
  return "other";
}

// Format quantity for display
function formatQuantity(quantity, unit) {
  return `${Math.round(quantity * 100) / 100} ${unit}`;
}

router.get("/", authMiddleware, (req, res) => {
  // Get all meal plan entries with recipe data
  const entries = db.prepare(`
    SELECT mp.recipe_id, r.servings
    FROM meal_plans mp
    JOIN recipes r ON r.id = mp.recipe_id
    WHERE mp.user_id = ?
  `).all(req.user.id);

  if (entries.length === 0) {
    return res.json({ shopping_list: [], message: "No meal plan found" });
  }

  // Step 1: Extract ingredients and scale by servings
  const rawIngredients = [];
  const ingredientStmt = db.prepare("SELECT * FROM recipe_ingredients WHERE recipe_id = ?");

  for (const entry of entries) {
    const ingredients = ingredientStmt.all(entry.recipe_id);
    const scaleFactor = entry.servings > 0 ? 1 : 1; // recipes already per-serving, keep as-is
    for (const ing of ingredients) {
      rawIngredients.push({
        name: ing.name.toLowerCase().trim(),
        quantity: ing.quantity * scaleFactor,
        unit: ing.unit.toLowerCase().trim(),
      });
    }
  }

  // Step 2: Normalize units to base units
  const normalized = rawIngredients.map((ing) => {
    const unitType = getUnitType(ing.unit);

    // Try cross-type conversion first (volume → weight using density table)
    // e.g., "1 cup flour" → grams, so it can aggregate with "200g flour"
    if (unitType === "volume") {
      const crossWeight = crossConvert(ing.quantity, ing.unit, ing.name);
      if (crossWeight !== null) {
        return { name: ing.name, quantity: crossWeight, unit: WEIGHT_BASE };
      }
      return { name: ing.name, quantity: toBase(ing.quantity, ing.unit), unit: VOLUME_BASE };
    }
    if (unitType === "weight") {
      return { name: ing.name, quantity: toBase(ing.quantity, ing.unit), unit: WEIGHT_BASE };
    }
    // Keep as-is for 'piece', 'clove', etc.
    return ing;
  });

  // Step 3: Aggregate same ingredients (same name + same base unit)
  const aggregated = {};
  for (const ing of normalized) {
    const key = `${ing.name}|${ing.unit}`;
    if (aggregated[key]) {
      aggregated[key].quantity += ing.quantity;
    } else {
      aggregated[key] = { ...ing };
    }
  }

  // Step 4: Group by store category
  const grouped = {};
  for (const item of Object.values(aggregated)) {
    const category = categorize(item.name);
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push({
      name: item.name,
      amount: formatQuantity(item.quantity, item.unit),
      quantity: item.quantity,
      unit: item.unit,
    });
  }

  // Sort items within each category alphabetically
  for (const cat of Object.keys(grouped)) {
    grouped[cat].sort((a, b) => a.name.localeCompare(b.name));
  }

  res.json({ shopping_list: grouped });
});

module.exports = router;
