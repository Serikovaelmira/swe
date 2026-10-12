import { useEffect, useState } from "react";
import { api } from "../api/client";

const EMPTY_INGREDIENT = { name: "", quantity: "", unit: "g" };
const SLOTS = ["breakfast", "lunch", "dinner"];
const UNITS = ["g", "kg", "ml", "l", "cup", "cups", "tbsp", "tsp", "oz", "lb", "pcs"];
const capitalize = (s) => s[0].toUpperCase() + s.slice(1);

export default function Recipes() {
  const [recipes, setRecipes] = useState([]);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState("");
  const [mealSlots, setMealSlots] = useState(["lunch"]);
  const [servings, setServings] = useState(2);
  const [ingredients, setIngredients] = useState([{ ...EMPTY_INGREDIENT }]);
  const [manualCalories, setManualCalories] = useState("");

  const buildParams = () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (tagFilter) params.set("tag", tagFilter);
    return params;
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await api(`/recipes?${buildParams()}`);
        if (active) setRecipes(Array.isArray(data) ? data : []);
      } catch (err) {
        if (active) setError(err.message || "Could not load recipes");
      }
    };
    load();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, tagFilter]);

  const refreshRecipes = async () => {
    const data = await api(`/recipes?${buildParams()}`);
    setRecipes(Array.isArray(data) ? data : []);
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setSteps("");
    setMealSlots(["lunch"]);
    setServings(2);
    setIngredients([{ ...EMPTY_INGREDIENT }]);
    setManualCalories("");
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (recipe) => {
    setTitle(recipe.title);
    setDescription(recipe.description || "");
    setSteps(recipe.steps || "");
    setMealSlots(Array.isArray(recipe.meal_slots) && recipe.meal_slots.length ? recipe.meal_slots : [recipe.tag || "lunch"]);
    setServings(recipe.servings || 2);
    setIngredients((recipe.ingredients || []).map(({ name, quantity, unit }) => ({ name, quantity, unit })));
    setManualCalories(recipe.calories > 0 ? String(recipe.calories) : "");
    setEditingId(recipe.id);
    setShowForm(true);
  };

  const toggleSlot = (slot) =>
    setMealSlots((current) => current.includes(slot) ? current.filter((s) => s !== slot) : [...current, slot]);

  const updateIngredient = (index, field, value) =>
    setIngredients((current) => current.map((item, i) => i === index ? { ...item, [field]: value } : item));
  const addIngredient = () => setIngredients((current) => [...current, { ...EMPTY_INGREDIENT }]);
  const removeIngredient = (index) => setIngredients((current) => current.filter((_, i) => i !== index));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (!mealSlots.length) { setError("Choose at least one meal slot."); return; }

    const body = {
      title: title.trim(),
      description,
      steps,
      meal_slots: mealSlots,
      servings: Number(servings),
      calories: manualCalories === "" ? null : Number(manualCalories),
      ingredients: ingredients
        .filter((item) => item.name.trim())
        .map((item) => ({ name: item.name.trim(), quantity: Number(item.quantity) || 0, unit: item.unit })),
    };

    let recipeId = editingId;
    try {
      if (editingId) {
        await api(`/recipes/${editingId}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        const created = await api("/recipes", { method: "POST", body: JSON.stringify(body) });
        recipeId = created.id;
      }
    } catch (err) {
      setError(err.message || "Could not save recipe");
      return;
    }

    // Рецепт уже сохранён. Ошибка расчёта калорий его не отменяет.
    resetForm();
    try {
      await refreshRecipes();
    } catch (err) {
      setError(err.message || "Could not refresh recipes");
    }

        try {
      await api(`/nutrition/${recipeId}`, { method: "POST" });
      await refreshRecipes();
      setError("");
    } catch (nutritionError) {
      // Рецепт уже сохранён: это не ошибка сохранения, а информация.
      await refreshRecipes().catch(() => {});
      setError(`Рецепт сохранён. Автоматический расчёт калорий недоступен (${nutritionError.message}). Нажмите "Edit" и введите kcal на порцию вручную.`);
    }

  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this recipe?")) return;
    try {
      await api(`/recipes/${id}`, { method: "DELETE" });
      await refreshRecipes();
    } catch (err) {
      setError(err.message || "Could not delete recipe");
    }
  };

  const fetchNutrition = async (recipeId) => {
    setError("");
    try {
      await api(`/nutrition/${recipeId}`, { method: "POST" });
      await refreshRecipes();
    } catch (err) {
      setError(`Nutrition fetch failed: ${err.message}`);
    }
  };

  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
      <h1 className="page-title" style={{ margin: 0 }}>Recipes</h1>
      <button className="btn" onClick={() => { if (showForm) resetForm(); else { setShowForm(true); setEditingId(null); } }}>
        {showForm ? "Cancel" : "+ New Recipe"}
      </button>
    </div>

    <div className="row" style={{ marginBottom: "1rem" }}>
      <input className="flex-1" placeholder="Search recipes..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 0 }} />
      <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} style={{ width: 140, marginBottom: 0 }}>
        <option value="">All tags</option>
        {SLOTS.map((slot) => <option key={slot} value={slot}>{capitalize(slot)}</option>)}
      </select>
    </div>

    {error && <p className="error" role="alert">{error}</p>}

    {showForm && <div className="card">
      <h3>{editingId ? "Edit Recipe" : "New Recipe"}</h3>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="recipe-title">Title</label>
          <input id="recipe-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>

        <div className="row">
          <div className="flex-1 form-group">
            <label>Meal slots (select all that apply)</label>
            {SLOTS.map((slot) => <label key={slot} style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", marginRight: "1rem", fontWeight: 400 }}>
              <input type="checkbox" checked={mealSlots.includes(slot)} onChange={() => toggleSlot(slot)} style={{ width: "auto", margin: 0 }} />
              {capitalize(slot)}
            </label>)}
          </div>
          <div className="flex-1 form-group">
            <label htmlFor="recipe-servings">Servings</label>
            <input id="recipe-servings" type="number" min="1" value={servings} onChange={(e) => setServings(e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="recipe-description">Description</label>
          <textarea id="recipe-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </div>
        <div className="form-group">
          <label htmlFor="recipe-steps">Steps</label>
          <textarea id="recipe-steps" value={steps} onChange={(e) => setSteps(e.target.value)} rows={3} />
        </div>

        <div className="form-group">
          <label>Ingredients</label>
          {ingredients.map((item, i) => <div key={i} className="ingredient-row">
            <input style={{ flex: 2 }} placeholder="Ingredient name" value={item.name} onChange={(e) => updateIngredient(i, "name", e.target.value)} />
            <input style={{ flex: 1 }} type="number" min="0" placeholder="Qty" value={item.quantity} onChange={(e) => updateIngredient(i, "quantity", e.target.value)} />
            <select style={{ width: 70 }} value={item.unit} onChange={(e) => updateIngredient(i, "unit", e.target.value)}>
              {UNITS.map((unit) => <option key={unit}>{unit}</option>)}
            </select>
            {ingredients.length > 1 && <button type="button" onClick={() => removeIngredient(i)} style={{ color: "#e74c3c", background: "none", border: "none", cursor: "pointer" }}>✕</button>}
          </div>)}
          <button type="button" className="btn-small" style={{ color: "#3498db", borderColor: "#3498db", marginTop: "0.25rem" }} onClick={addIngredient}>+ Add ingredient</button>
        </div>

        <div className="form-group">
          <label htmlFor="manual-kcal">Calories per serving (optional, manual)</label>
          <input id="manual-kcal" type="number" min="0" value={manualCalories} onChange={(e) => setManualCalories(e.target.value)} />
        </div>

        <button type="submit" className="btn">{editingId ? "Update" : "Create"} Recipe</button>
      </form>
    </div>}

    {recipes.length === 0 && <p className="loading">No recipes yet. Create one!</p>}

    {recipes.map((recipe) => <div key={recipe.id} className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h3 style={{ marginBottom: "0.25rem" }}>{recipe.title}</h3>
          {(recipe.meal_slots?.length ? recipe.meal_slots : [recipe.tag]).map((slot) => <span key={slot} className={`tag ${slot}`} style={{ marginRight: "0.25rem" }}>{slot}</span>)}
          <span style={{ fontSize: "0.8rem", color: "#999", marginLeft: "0.5rem" }}>{recipe.servings} servings</span>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn-small" style={{ color: "#3498db", borderColor: "#3498db" }} onClick={() => startEdit(recipe)}>Edit</button>
          <button className="btn-small" style={{ color: "#e74c3c", borderColor: "#e74c3c" }} onClick={() => handleDelete(recipe.id)}>Delete</button>
        </div>
      </div>
      {recipe.description && <p style={{ fontSize: "0.85rem", color: "#666", marginTop: "0.5rem" }}>{recipe.description}</p>}
      <div style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>
        <strong>Ingredients: </strong>{(recipe.ingredients || []).map((item) => `${item.quantity} ${item.unit} ${item.name}`).join(", ")}
      </div>
      {recipe.calories > 0 ? <div className="nutrition-info">
        <span>{recipe.calories} kcal / serving</span><span>P: {recipe.protein}g</span><span>C: {recipe.carbs}g</span><span>F: {recipe.fat}g</span>
      </div> : <>
        <p style={{ fontSize: "0.8rem", color: "#999", marginTop: "0.5rem" }}>Calories not calculated</p>
        <button className="btn-small" style={{ color: "#27ae60", borderColor: "#27ae60", marginTop: "0.25rem" }} onClick={() => fetchNutrition(recipe.id)}>Fetch Nutrition</button>
      </>}
    </div>)}
  </div>;
}
