const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validateRecipe, parseManualCalories } = require("../lib/validation");

const valid = {
  title: "Oatmeal",
  meal_slots: ["breakfast"],
  servings: 2,
  ingredients: [{ name: "oats", quantity: 80, unit: "g" }],
};

test("accepts a valid recipe", () => {
  assert.equal(validateRecipe(valid), null);
});

test("rejects an empty title", () => {
  assert.match(validateRecipe({ ...valid, title: "   " }), /title/);
});

test("rejects a recipe without ingredients", () => {
  assert.match(validateRecipe({ ...valid, ingredients: [] }), /ingredient/);
});

test("rejects an unknown meal slot", () => {
  assert.match(validateRecipe({ ...valid, meal_slots: ["brunch"] }), /meal slots/);
});

test("rejects servings outside 1..100", () => {
  assert.match(validateRecipe({ ...valid, servings: 0 }), /Servings/);
  assert.match(validateRecipe({ ...valid, servings: 101 }), /Servings/);
});

test("rejects a negative ingredient quantity", () => {
  const bad = { ...valid, ingredients: [{ name: "oats", quantity: -5, unit: "g" }] };
  assert.match(validateRecipe(bad), /non-negative/);
});

test("parseManualCalories returns null for empty or negative values", () => {
  assert.equal(parseManualCalories(""), null);
  assert.equal(parseManualCalories(-10), null);
  assert.equal(parseManualCalories("350.6"), 351);
});
