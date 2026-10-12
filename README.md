# Smart Recipe & Meal Planner System

A web application for managing recipes, planning weekly meals, and generating smart shopping lists.

## Tech Stack

- **Backend:** Node.js, Express, SQLite (better-sqlite3), JWT auth
- **Frontend:** React (Vite), React Router
- **Third-party APIs:** Edamam (nutrition data), OpenAI (recipe suggestions)

## Setup

```bash
# Install dependencies
npm install
cd client && npm install && cd ..

# Configure environment variables
# Copy .env and fill in your API keys (optional — app works without them)
cp .env .env.local

# Run development servers
npm run dev
```

The app starts at `http://localhost:5173` (frontend) with API at `http://localhost:3001`.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `JWT_SECRET` | Secret key for JWT tokens | Yes |
| `EDAMAM_APP_ID` | Edamam API app ID | Optional |
| `EDAMAM_APP_KEY` | Edamam API key | Optional |
| `OPENAI_API_KEY` | OpenAI API key | Optional |

## Project Structure

```
meal-planner/
├── server/
│   ├── middleware/auth.js       # JWT authentication
│   ├── routes/
│   │   ├── users.js             # CRUD: user registration, login, profile
│   │   ├── recipes.js           # CRUD: recipe management
│   │   ├── mealPlans.js         # CRUD: weekly meal plan
│   │   ├── nutrition.js         # 3rd-party: Edamam nutrition API
│   │   ├── aiSuggestions.js     # 3rd-party: OpenAI recipe suggestions
│   │   ├── generatePlan.js      # Complex: meal plan auto-generation algorithm
│   │   └── shoppingList.js      # Complex: shopping list with unit normalization
│   ├── database.js              # SQLite schema & connection
│   └── index.js                 # Express server entry point
├── client/
│   └── src/
│       ├── pages/               # React pages (Login, Recipes, MealPlan, etc.)
│       ├── api/client.js        # API client with auth
│       ├── App.jsx              # Router & layout
│       └── App.css              # Styles
└── .env                         # Environment variables
```

## Features

### CRUD
- User registration, login, profile management (dietary preferences, calorie goal)
- Recipe CRUD with ingredients, steps, tags (breakfast/lunch/dinner)
- Weekly meal plan: assign recipes to day + meal slot

### Third-Party Services
- **Edamam API** — fetch and cache nutrition data (calories, protein, carbs, fat) per recipe
- **OpenAI API** — AI-powered recipe suggestions based on available ingredients

### Complex Algorithms
- **Meal plan auto-generation** — constraint-based greedy algorithm with weighted scoring (calorie fit + variety) and backtracking
- **Shopping list generator** — multi-step pipeline: extract → scale → normalize units (conversion graph + ingredient density table) → aggregate → group by store section
