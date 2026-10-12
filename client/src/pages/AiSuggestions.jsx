import { useState } from "react";
import { api } from "../api/client";
export default function AiSuggestions() {
  const [input, setInput] = useState(""); const [suggestions, setSuggestions] = useState([]); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [saved, setSaved] = useState("");
  const handleSubmit = async (event) => {
    event.preventDefault(); if (!input.trim()) return; setLoading(true); setError(""); setSuggestions([]);
    try { const ingredients = input.split(",").map((item) => item.trim()).filter(Boolean); setSuggestions(await api("/ai-suggestions", { method: "POST", body: JSON.stringify({ ingredients }) })); }
    catch (err) { setError(err.message || "Could not generate suggestions"); }
    finally { setLoading(false); }
  };
  const saveRecipe = async (suggestion) => {
    try { const slots = Array.isArray(suggestion.meal_slots) && suggestion.meal_slots.length ? suggestion.meal_slots : [suggestion.tag || "lunch"];
      await api("/recipes", { method: "POST", body: JSON.stringify({ title: suggestion.title, description: suggestion.description || "", steps: Array.isArray(suggestion.steps) ? suggestion.steps.join("\n") : (suggestion.steps || ""), tag: slots[0], meal_slots: slots, servings: suggestion.servings || 2, ingredients: (suggestion.ingredients || []).map((item) => ({ name: item.name, quantity: Number(item.quantity) || 1, unit: item.unit || "pcs" })) }) });
      setSaved(suggestion.title); setTimeout(() => setSaved(""), 3000);
    } catch (err) { setError(`Could not save recipe: ${err.message}`); }
  };
  const configurationError = error.toLowerCase().includes("openai api not configured") || error.toLowerCase().includes("openai_api_key");
  return <div><h1 className="page-title">AI Recipe Suggestions</h1><p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "1rem" }}>Enter ingredients you have, and AI will suggest recipes you can make.</p>
    <div className="card"><form onSubmit={handleSubmit}><div className="form-group"><label>Your ingredients (comma-separated)</label><input placeholder="e.g. chicken, rice, garlic, soy sauce, ginger" value={input} onChange={(e) => setInput(e.target.value)} /></div><button type="submit" className="btn" disabled={loading}>{loading ? "Thinking..." : "Get Suggestions"}</button></form></div>
    {error && <div className="error" role="alert"><p>{configurationError ? "AI suggestions need an OpenAI API key configured on the server. Add OPENAI_API_KEY to the server's private .env file, restart the server, and try again. Never place the key in client code or share it." : error}</p></div>}
    {saved && <p className="success">"{saved}" saved to your recipes!</p>}
    {suggestions.map((suggestion, index) => <div key={`${suggestion.title}-${index}`} className="suggestion-card"><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}><div><h3>{suggestion.title}</h3><span className={`tag ${suggestion.tag}`}>{suggestion.tag || "lunch"}</span></div><button className="btn btn-success" onClick={() => saveRecipe(suggestion)}>Save as Recipe</button></div>{suggestion.description && <p style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>{suggestion.description}</p>}{suggestion.ingredients && <div style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}><strong>Ingredients: </strong>{suggestion.ingredients.map((item) => `${item.quantity} ${item.unit} ${item.name}`).join(", ")}</div>}{suggestion.steps && <div style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}><strong>Steps: </strong>{Array.isArray(suggestion.steps) ? suggestion.steps.join(" → ") : suggestion.steps}</div>}</div>)}
  </div>;
}
