import { useState, useEffect } from "react";
import { api } from "../api/client";

export default function ShoppingList() {
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchList = async () => {
      try {
        const data = await api("/shopping-list");
        setList(data.shopping_list);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchList();
  }, []);

  if (loading) return <div className="loading">Loading...</div>;

  const categories = list ? Object.keys(list) : [];

  return (
    <div>
      <h1 className="page-title">Shopping List</h1>
      <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "1rem" }}>
        Auto-generated from your meal plan. Ingredients are aggregated, units normalized, and grouped by store section.
      </p>

      {error && <p className="error">{error}</p>}

      {categories.length === 0 ? (
        <div className="card">
          <p style={{ color: "#999" }}>No items. Create a meal plan first.</p>
        </div>
      ) : (
        categories.map((category) => (
          <div key={category} className="card category-group">
            <h3>{category}</h3>
            <ul>
              {list[category].map((item, i) => (
                <li key={i}>
                  <strong>{item.name}</strong> — {item.amount}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
