require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/users", require("./routes/users"));
app.use("/api/recipes", require("./routes/recipes"));
app.use("/api/meal-plans", require("./routes/mealPlans"));
app.use("/api/nutrition", require("./routes/nutrition"));
app.use("/api/ai-suggestions", require("./routes/aiSuggestions"));
app.use("/api/generate-plan", require("./routes/generatePlan"));
app.use("/api/shopping-list", require("./routes/shoppingList"));

// Serve frontend in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../client/dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../client/dist/index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
