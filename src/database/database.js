import * as SQLite from 'expo-sqlite';

let dbInstance = null;

export const getDbConnection = async () => {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync('yemek_siparis.db');
  }
  return dbInstance;
};

export const initDatabase = async () => {
  const db = await getDbConnection();
  if (!db) return;

  await db.execAsync(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS lu_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ingredient_name TEXT UNIQUE NOT NULL,
      is_packaging INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS lu_units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_name TEXT NOT NULL,
      unit_symbol TEXT UNIQUE NOT NULL
    );
    CREATE TABLE IF NOT EXISTS lu_meals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_name TEXT UNIQUE NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ingredient_costs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ingredient_id INTEGER UNIQUE NOT NULL,
      unit_id INTEGER NOT NULL,
      quantity REAL NOT NULL,
      total_cost REAL NOT NULL,
      FOREIGN KEY (ingredient_id) REFERENCES lu_ingredients(id),
      FOREIGN KEY (unit_id) REFERENCES lu_units(id)
    );
    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_id INTEGER NOT NULL,
      portion_quantity REAL NOT NULL,
      portion_unit_id INTEGER NOT NULL,
      cooking_time INTEGER,
      calculated_cost REAL,
      sale_price REAL DEFAULT 0,
      FOREIGN KEY (meal_id) REFERENCES lu_meals(id),
      FOREIGN KEY (portion_unit_id) REFERENCES lu_units(id)
    );
    CREATE TABLE IF NOT EXISTS recipe_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL,
      ingredient_id INTEGER NOT NULL,
      quantity REAL NOT NULL,
      unit_id INTEGER NOT NULL,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
      FOREIGN KEY (ingredient_id) REFERENCES lu_ingredients(id),
      FOREIGN KEY (unit_id) REFERENCES lu_units(id)
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      delivery_datetime TEXT NOT NULL,
      notes TEXT,
      status TEXT DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      meal_id INTEGER NOT NULL,
      quantity REAL NOT NULL,
      unit_id INTEGER NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (meal_id) REFERENCES lu_meals(id),
      FOREIGN KEY (unit_id) REFERENCES lu_units(id)
    );
    CREATE TABLE IF NOT EXISTS order_packagings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      ingredient_id INTEGER NOT NULL,
      quantity_used REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (ingredient_id) REFERENCES lu_ingredients(id)
    );
  `);

  try {
    await db.execAsync(`ALTER TABLE order_items ADD COLUMN item_cost REAL DEFAULT 0;`);
  } catch (e) {}
  try {
    await db.execAsync(`ALTER TABLE order_items ADD COLUMN item_sale REAL DEFAULT 0;`);
  } catch (e) {}
  try {
    await db.execAsync(`ALTER TABLE lu_ingredients ADD COLUMN is_packaging INTEGER DEFAULT 0;`);
  } catch (e) {}

  const count = await db.getFirstAsync('SELECT COUNT(*) as count FROM lu_units');
  if (count.count === 0) {
    await db.execAsync(`
      INSERT INTO lu_units (unit_name, unit_symbol) VALUES 
      ('Kilogram', 'kg'), ('Gram', 'gr'), ('Litre', 'lt'), 
      ('Mililitre', 'mlt'), ('Adet', 'adet'), ('Paket', 'pkt'), ('Dakika', 'dk');
    `);
  }
};

export const resetDatabase = async () => {
  try {
    const db = await getDbConnection();
    if (!db) return false;

    await db.execAsync(`
      DROP TABLE IF EXISTS order_packagings;
      DROP TABLE IF EXISTS order_items;
      DROP TABLE IF EXISTS orders;
      DROP TABLE IF EXISTS recipe_items;
      DROP TABLE IF EXISTS recipes;
      DROP TABLE IF EXISTS ingredient_costs;
      DROP TABLE IF EXISTS lu_ingredients;
      DROP TABLE IF EXISTS lu_meals;
      DROP TABLE IF EXISTS lu_units;
    `);

    await initDatabase();
    console.log('Veritabanı başarıyla sıfırlandı.');
    return true;
  } catch (e) {
    console.log('Veritabanı sıfırlama hatası:', e);
    return false;
  }
};