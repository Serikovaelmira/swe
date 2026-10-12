import { useState, useEffect } from "react";
import { api } from "../api/client";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const SLOTS = ["breakfast", "lunch", "dinner"];

export default function MealPlan() {
  const [plan, setPlan] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [assignDay, setAssignDay] = useState("monday");
  const [assignSlot, setAssignSlot] = useState("breakfast");
  const [assignRecipe, setAssignRecipe] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const fetchPlan = async () => {
    try {
      const data = await api("/meal-plans");
      setPlan(data);
    } catch (err) {
      setError(err.message);
    }
  };



  useEffect(() => {
  let active = true;

  const loadData = async () => {
    try {
      const [planData, recipesData] = await Promise.all([
        api("/meal-plans"),
        api("/recipes"),
      ]);

      if (!active) return;

      setPlan(planData);
      setRecipes(recipesData);

      if (recipesData.length > 0) {
        setAssignRecipe(recipesData[0].id);
      }
    } catch (err) {
      if (active) setError(err.message);
    }
  };

  loadData();

  return () => {
    active = false;
  };
}, []);


  const getEntry = (day, slot) => plan.find((p) => p.day === day && p.slot === slot);

  const handleAssign = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api("/meal-plans", {
        method: "POST",
        body: JSON.stringify({ recipe_id: Number(assignRecipe), day: assignDay, slot: assignSlot }),
      });
      fetchPlan();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemove = async (id) => {
    try {
      await api(`/meal-plans/${id}`, { method: "DELETE" });
      fetchPlan();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleClear = async () => {
    if (!confirm("Clear entire meal plan?")) return;
    try {
      await api("/meal-plans", { method: "DELETE" });
      setPlan([]);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGenerate = async () => {
    setError("");
    setMessage("");
    try {
      const data = await api("/generate-plan", { method: "POST" });
      setMessage(`Plan generated! Weekly total: ${data.total_weekly_calories} kcal`);
      fetchPlan();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 className="page-title" style={{ margin: 0 }}>Meal Plan</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn btn-success" onClick={handleGenerate}>Auto-Generate</button>
          <button className="btn btn-danger" onClick={handleClear}>Clear</button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}

      {/* Assign form */}
      <div className="card">
        <form onSubmit={handleAssign} className="row" style={{ alignItems: "flex-end" }}>
          <div className="flex-1">
            <label>Day</label>
            <select value={assignDay} onChange={(e) => setAssignDay(e.target.value)}>
              {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label>Slot</label>
            <select value={assignSlot} onChange={(e) => setAssignSlot(e.target.value)}>
              {SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label>Recipe</label>
            <select value={assignRecipe} onChange={(e) => setAssignRecipe(e.target.value)}>
              {recipes.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
          </div>
          <button type="submit" className="btn" style={{ marginBottom: "0.5rem" }}>Assign</button>
        </form>
      </div>

      {/* Meal plan grid */}
      <div className="meal-grid">
        <div></div>
        {SLOTS.map((s) => <div key={s} className="slot-header">{s}</div>)}
        {DAYS.map((day) => (
          <>
            <div key={day} className="day-label">{day}</div>
            {SLOTS.map((slot) => {
              const entry = getEntry(day, slot);
              return (
                <div key={`${day}-${slot}`} className="meal-cell">
                  {entry ? (
                    <>
                      <span>{entry.title}</span>
                      {entry.calories > 0 && (
                        <div style={{ fontSize: "0.7rem", color: "#999" }}>{entry.calories} kcal</div>
                      )}
                      <button className="remove-btn" onClick={() => handleRemove(entry.id)}>✕</button>
                    </>
                  ) : (
                    <span style={{ color: "#ccc", fontSize: "0.75rem" }}>—</span>
                  )}
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}
