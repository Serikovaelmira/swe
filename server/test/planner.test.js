const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildPlan, recipeSlots, isValidSlotList, SLOTS } = require("../lib/planner");

const recipe = (id, slots, calories) => ({ id, title: `R${id}`, meal_slots: slots, calories });
const fullSet = [
  recipe(1, ["breakfast"], 400),
  recipe(2, ["lunch", "dinner"], 600),
  recipe(3, ["dinner"], 700),
  recipe(4, ["breakfast", "lunch"], 500),
];

test("recipeSlots reads an array, a JSON string, and the legacy tag", () => {
  assert.deepEqual(recipeSlots({ meal_slots: ["lunch"] }), ["lunch"]);
  assert.deepEqual(recipeSlots({ meal_slots: '["dinner","lunch"]' }), ["dinner", "lunch"]);
  assert.deepEqual(recipeSlots({ meal_slots: "[]", tag: "breakfast" }), ["breakfast"]);
});

test("isValidSlotList accepts only known slots", () => {
  assert.equal(isValidSlotList(["breakfast", "dinner"]), true);
  assert.equal(isValidSlotList([]), false);
  assert.equal(isValidSlotList(["brunch"]), false);
});

test("returns an error naming the slot when no recipe covers it", () => {
  const result = buildPlan({ recipes: [recipe(1, ["breakfast"], 400), recipe(2, ["lunch"], 600)], target: 2000 });
  assert.match(result.error, /dinner/);
  assert.equal(result.plan, undefined);
});

test("recipes without calories are excluded from the plan", () => {
  const recipes = [
    recipe(1, ["breakfast"], 0),
    recipe(2, ["lunch", "dinner"], 600),
    recipe(3, ["dinner"], 700),
    recipe(4, ["breakfast", "lunch"], 0),
  ];
  const result = buildPlan({ recipes, target: 2000 });
  assert.match(result.error, /breakfast/);
});

test("strict slot matching: each slot gets a recipe tagged for it", () => {
  const { plan } = buildPlan({ recipes: fullSet, target: 1800 });
  assert.equal(plan.length, 7 * SLOTS.length);
  const byId = Object.fromEntries(fullSet.map((r) => [r.id, r]));
  for (const entry of plan) {
    assert.ok(recipeSlots(byId[entry.recipe_id]).includes(entry.slot), `${entry.slot} <- ${entry.title}`);
  }
});

test("total equals the sum of the calories of the plan entries", () => {
  const { plan, total } = buildPlan({ recipes: fullSet, target: 1800 });
  assert.equal(total, plan.reduce((sum, x) => sum + x.calories, 0));
});
