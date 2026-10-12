// Converts an ingredient quantity to a base unit: grams (mass), milliliters (volume), or pieces (count).
const MASS_TO_G = { g: 1, kg: 1000, oz: 28.3495, lb: 453.592 };
const VOLUME_TO_ML = { ml: 1, l: 1000, cup: 240, cups: 240, tbsp: 15, tsp: 5 };

function normalizeQuantity(quantity, unit) {
  const q = Number(quantity);
  if (!Number.isFinite(q) || q < 0) return null;
  const u = String(unit || "").trim().toLowerCase();
  if (u in MASS_TO_G) return { kind: "mass", value: q * MASS_TO_G[u] };
  if (u in VOLUME_TO_ML) return { kind: "volume", value: q * VOLUME_TO_ML[u] };
  if (u === "pcs") return { kind: "count", value: q };
  return null; // unknown unit: do not guess
}

module.exports = { normalizeQuantity };
