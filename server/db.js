import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 容器部署时通过 DATA_DIR 挂载持久化磁盘；本地开发仍使用 server/data。
const dataDir = process.env.DATA_DIR || path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(path.join(dataDir, "nancy.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export const now = () => new Date().toISOString();

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  passwordHash TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  lastLoginAt TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  userId INTEGER NOT NULL,
  createdAt TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  sortOrder INTEGER NOT NULL DEFAULT 0,
  isDefault INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  projectId INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  textColor TEXT NOT NULL DEFAULT '#4A3F55',
  backgroundColor TEXT NOT NULL DEFAULT '#FFFFFF',
  fontFamily TEXT NOT NULL DEFAULT 'system-ui',
  fontSize INTEGER NOT NULL DEFAULT 16,
  isFavorite INTEGER NOT NULL DEFAULT 0,
  isDeleted INTEGER NOT NULL DEFAULT 0,
  deletedAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  noteId INTEGER,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  filename TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  metadata TEXT,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (noteId) REFERENCES notes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recipe_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  name TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recipe_draws (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  itemId INTEGER,
  itemName TEXT NOT NULL,
  itemNumber INTEGER NOT NULL,
  total INTEGER NOT NULL,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS wardrobes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  title TEXT NOT NULL,
  isFavorite INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS wardrobe_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wardrobeListId INTEGER NOT NULL,
  sectionType TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  imageUrl TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (wardrobeListId) REFERENCES wardrobes(id) ON DELETE CASCADE,
  UNIQUE(wardrobeListId, sectionType)
);

CREATE TABLE IF NOT EXISTS plan_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  title TEXT NOT NULL,
  startDate TEXT NOT NULL,
  endDate TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#CDB4DB',
  note TEXT NOT NULL DEFAULT '',
  isDone INTEGER NOT NULL DEFAULT 0,
  isFavorite INTEGER NOT NULL DEFAULT 0,
  isDeleted INTEGER NOT NULL DEFAULT 0,
  deletedAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS drawings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  title TEXT NOT NULL,
  imageUrl TEXT NOT NULL,
  isFavorite INTEGER NOT NULL DEFAULT 0,
  isDeleted INTEGER NOT NULL DEFAULT 0,
  deletedAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
`);

export function toBoolRows(rows, fields = ["isDefault", "isFavorite", "isDeleted", "isDone"]) {
  return rows.map((row) => {
    const copy = { ...row };
    fields.forEach((field) => {
      if (field in copy) copy[field] = Boolean(copy[field]);
    });
    return copy;
  });
}

export function cleanupTrash(userId) {
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare("DELETE FROM notes WHERE userId = ? AND isDeleted = 1 AND deletedAt < ?").run(userId, cutoff);
  db.prepare("DELETE FROM wardrobes WHERE userId = ? AND isDeleted = 1 AND deletedAt < ?").run(userId, cutoff);
  db.prepare("DELETE FROM plan_tasks WHERE userId = ? AND isDeleted = 1 AND deletedAt < ?").run(userId, cutoff);
  db.prepare("DELETE FROM drawings WHERE userId = ? AND isDeleted = 1 AND deletedAt < ?").run(userId, cutoff);
}

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((item) => item.name);
  if (!columns.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

ensureColumn("wardrobes", "isDeleted", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("wardrobes", "deletedAt", "TEXT");
ensureColumn("wardrobes", "isFavorite", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("plan_tasks", "isFavorite", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("drawings", "isFavorite", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("plan_tasks", "isDeleted", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("plan_tasks", "deletedAt", "TEXT");
ensureColumn("drawings", "isDeleted", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("drawings", "deletedAt", "TEXT");
