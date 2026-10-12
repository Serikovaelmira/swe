const BASE = "https://generativelanguage.googleapis.com/v1beta";
const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest", "gemini-1.5-flash"];
const RETRY_STATUSES = [429, 500, 503];
const MAX_ATTEMPTS = 3;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let cachedModels = null;

function parseJsonText(text) {
  const cleaned = String(text).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  return JSON.parse(cleaned);
}

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

async function discoverModels(key) {
  if (cachedModels) return cachedModels;
  const res = await fetch(`${BASE}/models?pageSize=100`, { headers: { "x-goog-api-key": key } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw httpError(res.status, data?.error?.message || `Gemini HTTP ${res.status} при получении списка моделей`);
  const names = (data.models || [])
    .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes("generateContent"))
    .map((m) => String(m.name || "").replace(/^models\//, ""))
    .filter((n) => n.startsWith("gemini") && !/tts|image|embedding|live|audio/i.test(n));
  names.sort((a, b) => score(b) - score(a));
  cachedModels = names.length ? names : FALLBACK_MODELS;
  return cachedModels;
}

function score(name) {
  let s = 0;
  if (/flash/.test(name)) s += 10;
  if (/2\.5/.test(name)) s += 4;
  else if (/2\.0/.test(name)) s += 3;
  if (/preview|exp/.test(name)) s -= 5;
  if (/lite/.test(name)) s -= 1;
  return s;
}

// Возвращает разобранный JSON от Gemini. Временные ошибки (503/500/429) повторяются с паузой.
async function askGeminiJson(system, user) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw httpError(503, "GEMINI_API_KEY не задан в корневом .env");

  const models = process.env.GEMINI_MODEL
    ? [process.env.GEMINI_MODEL, ...(await discoverModels(key))]
    : await discoverModels(key);

  let lastTemporary = null;

  for (const model of [...new Set(models)]) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const res = await fetch(`${BASE}/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.3 },
        }),
      });

      if (res.status === 404) {
        cachedModels = null;
        break; // модель недоступна: следующая
      }

      if (RETRY_STATUSES.includes(res.status)) {
        const data = await res.json().catch(() => ({}));
        lastTemporary = data?.error?.message || `Gemini HTTP ${res.status}`;
        if (attempt < MAX_ATTEMPTS) await sleep(2000 * attempt);
        continue;
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw httpError(res.status, data?.error?.message || `Gemini HTTP ${res.status}`);

      const candidate = data?.candidates?.[0];
      const text = candidate?.content?.parts?.map((p) => p.text || "").join("") || "";
      if (!text.trim()) throw httpError(502, `Gemini вернул пустой ответ (finishReason: ${candidate?.finishReason || "нет"})`);
      try {
        return parseJsonText(text);
      } catch {
        throw httpError(502, "Gemini вернул ответ не в формате JSON");
      }
    }
  }

  if (lastTemporary) throw httpError(503, `Gemini временно перегружен: ${lastTemporary}. Подождите минуту и нажмите Fetch Nutrition ещё раз.`);
  throw httpError(502, "Ни одна модель Gemini не доступна для этого ключа.");
}

module.exports = { askGeminiJson };
