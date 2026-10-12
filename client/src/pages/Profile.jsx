import { useMemo, useState } from "react";
import { api } from "../api/client";

function recommendedCalories(sex, weight, height, goal) {
  const w = Number(weight); const h = Number(height);
  if (!sex || !w || !h) return null;
  // Mifflin-St Jeor with clearly disclosed defaults: age 30 and sedentary activity (1.2).
  const bmr = 10 * w + 6.25 * h - 10 * 30 + (sex === "male" ? 5 : -161);
  const maintenance = Math.round(bmr * 1.2);
  const adjustment = goal === "lose" ? -300 : goal === "gain_muscle" ? 250 : 0;
  return Math.min(5000, Math.max(sex === "female" ? 1200 : 1500, Math.round(maintenance + adjustment)));
}

export default function Profile({ user, setUser }) {
  const [name, setName] = useState(user.name || "");
  const [dietary, setDietary] = useState(user.dietary_preferences || "");
  const [sex, setSex] = useState(user.sex || "");
  const [weight, setWeight] = useState(user.weight_kg ?? "");
  const [height, setHeight] = useState(user.height_cm ?? "");
  const [goal, setGoal] = useState(user.goal || "maintain");
  const recommendation = useMemo(() => recommendedCalories(sex, weight, height, goal), [sex, weight, height, goal]);
  const [calories, setCalories] = useState(String(user.calorie_goal || 2000));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault(); setError(""); setMessage(""); setSaving(true);
    try {
      const updated = await api("/users/me", { method: "PUT", body: JSON.stringify({
        name, dietary_preferences: dietary, sex, weight_kg: weight === "" ? null : Number(weight),
        height_cm: height === "" ? null : Number(height), goal, calorie_goal: Number(calories),
      }) });
      setUser(updated); setMessage("Profile updated");
    } catch (err) { setError(err.message || "Profile update failed"); }
    finally { setSaving(false); }
  };

  return <div>
    <h1 className="page-title">Profile</h1>
    <div className="card" style={{ maxWidth: 500 }}>
      {error && <p className="error" role="alert">{error}</p>}{message && <p className="success" role="status">{message}</p>}
      <form onSubmit={handleSubmit}>
        <div className="form-group"><label htmlFor="profile-name">Name</label><input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} required /></div>
        <div className="form-group"><label htmlFor="dietary-preferences">Dietary Preferences</label><input id="dietary-preferences" value={dietary} onChange={(e) => setDietary(e.target.value)} placeholder="e.g. vegetarian, gluten-free" /><small style={{ color: "#999" }}>Comma-separated. Used for meal plan generation.</small></div>
        <div className="form-group"><label htmlFor="profile-sex">Sex for calorie estimate</label><select id="profile-sex" value={sex} onChange={(e) => setSex(e.target.value)} required><option value="">Select</option><option value="female">Female</option><option value="male">Male</option></select></div>
        <div className="row"><div className="flex-1 form-group"><label htmlFor="weight">Weight (kg)</label><input id="weight" type="number" min="20" max="350" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} required /></div><div className="flex-1 form-group"><label htmlFor="height">Height (cm)</label><input id="height" type="number" min="100" max="250" step="0.1" value={height} onChange={(e) => setHeight(e.target.value)} required /></div></div>
        <div className="form-group"><label htmlFor="goal">Goal</label><select id="goal" value={goal} onChange={(e) => setGoal(e.target.value)}><option value="lose">Lose weight</option><option value="gain_muscle">Gain muscle</option><option value="maintain">Maintain current weight</option></select></div>
        {recommendation !== null && <div className="form-group"><p>Suggested target: <strong>{recommendation} kcal/day</strong></p><small style={{ color: "#777" }}>Estimate uses Mifflin–St Jeor, assumed age 30 and sedentary activity. It is a general estimate, not medical advice. You can change the target below.</small><button type="button" className="btn-small" style={{ color: "#3498db", borderColor: "#3498db", marginTop: "0.5rem" }} onClick={() => setCalories(String(recommendation))}>Use recommendation</button></div>}
        <div className="form-group"><label htmlFor="calorie-goal">Daily Calorie Goal (editable)</label><input id="calorie-goal" type="number" value={calories} onChange={(e) => setCalories(e.target.value)} min="500" max="5000" required /></div>
        <button type="submit" className="btn" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
      </form>
    </div>
  </div>;
}
