const { test } = require("node:test");
const assert = require("node:assert/strict");
const { normalizeQuantity } = require("../lib/units");

test("converts grams and kilograms to grams", () => {
  assert.deepEqual(normalizeQuantity(2, "kg"), { kind: "mass", value: 2000 });
  assert.deepEqual(normalizeQuantity(150, "g"), { kind: "mass", value: 150 });
});

test("converts tablespoons and liters to milliliters", () => {
  assert.deepEqual(normalizeQuantity(2, "tbsp"), { kind: "volume", value: 30 });
  assert.deepEqual(normalizeQuantity(1, "l"), { kind: "volume", value: 1000 });
});

test("keeps piece counts as counts", () => {
  assert.deepEqual(normalizeQuantity(3, "pcs"), { kind: "count", value: 3 });
});

test("rejects unknown units and negative or non-numeric values", () => {
  assert.equal(normalizeQuantity(1, "handful"), null);
  assert.equal(normalizeQuantity(-1, "g"), null);
  assert.equal(normalizeQuantity("abc", "g"), null);
});
