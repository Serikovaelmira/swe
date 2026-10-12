const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "meal_planner.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    dietary_preferences TEXT DEFAULT '',
    calorie_goal INTEGER DEFAULT 2000,
    sex TEXT DEFAULT '',
    weight_kg REAL,
    height_cm REAL,
    goal TEXT DEFAULT 'maintain',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    steps TEXT DEFAULT '',
    tag TEXT DEFAULT 'lunch',
    meal_slots TEXT NOT NULL DEFAULT '[]',
    servings INTEGER DEFAULT 2,
    calories INTEGER DEFAULT 0,
    protein REAL DEFAULT 0,
    carbs REAL DEFAULT 0,
    fat REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS meal_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    recipe_id INTEGER NOT NULL,
    day TEXT NOT NULL,
    slot TEXT NOT NULL,
    UNIQUE(user_id, day, slot),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
  );
`);

// Idempotent migrations for databases created by earlier project versions.
function ensureColumn(table, column, definition) {
  const columns = db.pragma(`table_info(${table})`);
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
ensureColumn("users", "sex", "TEXT DEFAULT ''");
ensureColumn("users", "weight_kg", "REAL");
ensureColumn("users", "height_cm", "REAL");
ensureColumn("users", "goal", "TEXT DEFAULT 'maintain'");
ensureColumn("recipes", "meal_slots", "TEXT NOT NULL DEFAULT '[]'");

module.exports = db;