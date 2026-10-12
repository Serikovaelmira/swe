import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Recipes from "./pages/Recipes";
import MealPlan from "./pages/MealPlan";
import ShoppingList from "./pages/ShoppingList";
import Profile from "./pages/Profile";
import AiSuggestions from "./pages/AiSuggestions";
import { api, clearToken } from "./api/client";
import "./App.css";

function Nav({ onLogout }) {
  return (
    <nav className="nav">
      <div className="nav-brand">Meal Planner</div>
      <div className="nav-links">
        <Link to="/recipes">Recipes</Link>
        <Link to="/meal-plan">Meal Plan</Link>
        <Link to="/shopping-list">Shopping List</Link>
        <Link to="/ai-suggestions">AI Suggestions</Link>
        <Link to="/profile">Profile</Link>
        <button onClick={onLogout} className="btn-small">Logout</button>
      </div>
    </nav>
  );
}

function AppContent() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() =>
  Boolean(localStorage.getItem("token"))
);

  const navigate = useNavigate();

  useEffect(() => {
  const token = localStorage.getItem("token");
  if (!token) return;

  let active = true;

  api("/users/me")
    .then((data) => {
      if (active) setUser(data);
    })
    .catch(() => {
      if (active) {
        clearToken();
        setUser(null);
      }
    })
    .finally(() => {
      if (active) setLoading(false);
    });

  return () => {
    active = false;
  };
}, []);


  const handleLogout = () => {
    clearToken();
    setUser(null);
    navigate("/login");
  };

  if (loading) return <div className="loading">Loading...</div>;

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login onLogin={setUser} />} />
        <Route path="/register" element={<Register onRegister={setUser} />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  return (
    <>
      <Nav onLogout={handleLogout} />
      <div className="container">
        <Routes>
          <Route path="/recipes" element={<Recipes />} />
          <Route path="/meal-plan" element={<MealPlan />} />
          <Route path="/shopping-list" element={<ShoppingList />} />
          <Route path="/ai-suggestions" element={<AiSuggestions />} />
          <Route path="/profile" element={<Profile user={user} setUser={setUser} />} />
          <Route path="*" element={<Navigate to="/recipes" />} />
        </Routes>
      </div>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
