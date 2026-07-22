import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db, now, toBoolRows, cleanupTrash } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
// 容器部署时通过 UPLOAD_DIR 挂载持久化磁盘；本地开发仍使用 server/uploads。
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const app = express();
const port = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === "production";
const appOrigin = process.env.APP_ORIGIN || "https://nancy-space.xyz";
const allowedOrigins = new Set((process.env.CORS_ORIGIN || (isProd ? appOrigin : "http://localhost:5173"))
  .split(",").map((origin) => origin.trim()).filter(Boolean));

if (isProd) app.set("trust proxy", 1);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error("不允许的跨域来源"));
  },
  credentials: true
}));
app.use(express.json({ limit: "25mb" }));
app.use(cookieParser());
app.use("/uploads", express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => cb(null, `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

const defaults = [
  ["日记", "diary"],
  ["食谱", "recipe"],
  ["衣橱", "wardrobe"],
  ["规划", "plan"],
  ["画画", "drawing"],
  ["给奶茶的悄悄话", "secret"]
];
const foods = ["烤鸭腿", "蛋包饭", "寿司", "披萨", "海鲜粥", "印度飞饼", "卤肉饭", "水果捞", "盖浇饭", "真功夫", "意大利面", "广式糖水", "红烧肉煲仔饭", "芝士焗饭", "鸡公煲", "炸鸡汉堡", "煎饺", "火锅", "烤肉", "盛香亭"];
const wardrobeSections = ["head", "face", "top", "bottom", "feet"];
const welcomeDiaryTitle = "关于奶昔的小世界";
const welcomeDiaryContent = `嘿嘿～这是奶茶写的使用指南！目前设置了6种功能：
1、文本功能：工具栏可以新建项目文件夹，作为日记本/摘抄本/草稿本…什么分类都可以。上面两个框框可以用来设置文本颜色和背景颜色，文本可以设置大小，字体暂时就4种……上传图片、音频，以及录音也是可以的！
2、食谱功能：鉴于“吃什么”这个问题经常消耗奶昔吃饭的动力，这个功能专为选择困难症而来！奶昔可以在食谱里加上自己喜欢吃的东西，以后想不出来就随机抽一个吧～
3、衣橱功能：参考了奶昔喜欢的电子衣橱！每套服装分为头部、面部、上身、下身、足部，可以自定义名称，可以添加文本注释和图片参考，帮助自己的四季套装一目了然！
4、规划功能：属于 J 人奶昔的时间表！可以自行选择时间、调整任务标签颜色及完成状态，每项任务会按甘特图的格式排列，直观了解同一时间点的待办事项！
5、画画功能：怎么能少得了这个！和 EMMO 一样，画好的作品可以保存至相册，虽然目前功能还不完善画笔还很烂…嗯但是基础的操作还是 ok 的…！
6、给奶茶的悄悄话：这个是作为服务器搭建者的奶茶唯一可以从后台看到的数据哦～一点小巧思是每条笔记会自动隐藏内容，点一下才能看见，就更像是那种小纸条啦！
另外，收藏夹用于存放喜欢的笔记，垃圾箱用于暂时存储已删除的笔记，默认存放3天后自动删除（也可以选择当即就删除）。奶昔也可以一个人开设好几个账号，在“账号管理”随时切换即可。

好啦，功能差不多就这些，有什么喜欢的功能欢迎投稿奶茶微信 or 悄悄话！

最后，祝最最最可爱的小奶昔 21 岁生日快乐！！！
奶茶爱你～

By Tea
26.7.21 finished`;
const sessionExpiresAt = () => new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

function publicUser(user) {
  return user && { id: user.id, username: user.username, createdAt: user.createdAt, updatedAt: user.updatedAt, lastLoginAt: user.lastLoginAt };
}

function seedUser(userId, { createWelcome = false } = {}) {
  const t = now();
  const count = db.prepare("SELECT COUNT(*) AS c FROM projects WHERE userId = ?").get(userId).c;
  if (!count) {
    const insert = db.prepare("INSERT INTO projects (userId, name, type, createdAt, updatedAt, sortOrder, isDefault) VALUES (?, ?, ?, ?, ?, ?, 1)");
    defaults.forEach(([name, type], i) => insert.run(userId, name, type, t, t, i));
  }
  const foodCount = db.prepare("SELECT COUNT(*) AS c FROM recipe_items WHERE userId = ?").get(userId).c;
  if (!foodCount) {
    const insertFood = db.prepare("INSERT INTO recipe_items (userId, name, createdAt, updatedAt) VALUES (?, ?, ?, ?)");
    foods.forEach((name) => insertFood.run(userId, name, t, t));
  }
  const diary = db.prepare("SELECT id FROM projects WHERE userId = ? AND type = 'diary' ORDER BY sortOrder LIMIT 1").get(userId);
  const noteCount = diary ? db.prepare("SELECT COUNT(*) AS c FROM notes WHERE userId = ? AND projectId = ?").get(userId, diary.id).c : 0;
  if (createWelcome && diary && !noteCount) {
    db.prepare(`INSERT INTO notes (userId, projectId, title, content, textColor, backgroundColor, fontFamily, fontSize, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(userId, diary.id, welcomeDiaryTitle, welcomeDiaryContent, "#F96CA4", "#FFE5E5", "cursive", 16, t, t);
  }
}

function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const createdAt = now();
  const expiresAt = sessionExpiresAt();
  db.prepare("INSERT INTO sessions (token, userId, createdAt, expiresAt) VALUES (?, ?, ?, ?)").run(token, userId, createdAt, expiresAt);
  res.cookie("nancy_session", token, { httpOnly: true, sameSite: "lax", secure: isProd, expires: new Date(expiresAt) });
}

function auth(req, res, next) {
  const token = req.cookies.nancy_session || req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "未登录" });
  const session = db.prepare("SELECT * FROM sessions WHERE token = ? AND expiresAt > ?").get(token, now());
  if (!session) {
    if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    res.clearCookie("nancy_session");
    return res.status(401).json({ error: "登录已过期" });
  }
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(session.userId);
  if (!row) return res.status(401).json({ error: "登录已过期" });
  req.user = row;
  cleanupTrash(row.id);
  next();
}

function requireOwner(table, id, userId) {
  return db.prepare(`SELECT * FROM ${table} WHERE id = ? AND userId = ?`).get(id, userId);
}

app.get("/health", (_, res) => res.json({ ok: true }));

app.post("/api/auth/register", (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  if (username.length < 2 || password.length < 4) return res.status(400).json({ error: "用户名至少 2 位，密码至少 4 位" });
  const t = now();
  try {
    const result = db.prepare("INSERT INTO users (username, passwordHash, createdAt, updatedAt) VALUES (?, ?, ?, ?)").run(username, bcrypt.hashSync(password, 10), t, t);
    seedUser(result.lastInsertRowid, { createWelcome: true });
    createSession(res, result.lastInsertRowid);
    res.json({ user: publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid)) });
  } catch {
    res.status(409).json({ error: "用户名已存在" });
  }
});

app.post("/api/auth/login", (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) return res.status(401).json({ error: "用户名或密码错误" });
  seedUser(user.id);
  db.prepare("UPDATE users SET lastLoginAt = ?, updatedAt = ? WHERE id = ?").run(now(), now(), user.id);
  createSession(res, user.id);
  res.json({ user: publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(user.id)) });
});

app.post("/api/auth/logout", auth, (req, res) => {
  const token = req.cookies.nancy_session;
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  res.clearCookie("nancy_session");
  res.json({ ok: true });
});

app.get("/api/me", auth, (req, res) => res.json({ user: publicUser(req.user) }));

app.get("/api/accounts", auth, (_, res) => {
  res.json(db.prepare("SELECT id, username, createdAt, updatedAt, lastLoginAt FROM users ORDER BY createdAt DESC").all());
});

app.post("/api/accounts", auth, (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  if (username.length < 2 || password.length < 4) return res.status(400).json({ error: "用户名至少 2 位，密码至少 4 位" });
  const t = now();
  try {
    const result = db.prepare("INSERT INTO users (username, passwordHash, createdAt, updatedAt) VALUES (?, ?, ?, ?)").run(username, bcrypt.hashSync(password, 10), t, t);
    seedUser(result.lastInsertRowid, { createWelcome: true });
    res.json(publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid)));
  } catch {
    res.status(409).json({ error: "用户名已存在" });
  }
});

app.post("/api/accounts/:id/switch", auth, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "账号不存在" });
  res.clearCookie("nancy_session");
  createSession(res, user.id);
  res.json({ user: publicUser(user) });
});

app.patch("/api/accounts/:id/password", auth, (req, res) => {
  if (Number(req.params.id) !== req.user.id) return res.status(403).json({ error: "只能修改当前账号密码" });
  const password = String(req.body.password || "");
  if (password.length < 4) return res.status(400).json({ error: "密码至少 4 位" });
  db.prepare("UPDATE users SET passwordHash = ?, updatedAt = ? WHERE id = ?").run(bcrypt.hashSync(password, 10), now(), req.user.id);
  res.json({ ok: true });
});

app.delete("/api/accounts/:id", auth, (req, res) => {
  db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
  if (Number(req.params.id) === req.user.id) res.clearCookie("nancy_session");
  res.json({ ok: true });
});

app.get("/api/projects", auth, (req, res) => {
  res.json(toBoolRows(db.prepare("SELECT * FROM projects WHERE userId = ? ORDER BY sortOrder, createdAt").all(req.user.id)));
});

app.post("/api/projects", auth, (req, res) => {
  const name = String(req.body.name || "新项目").trim();
  const type = req.body.type || "custom";
  const t = now();
  const sort = db.prepare("SELECT COALESCE(MAX(sortOrder), 0) + 1 AS n FROM projects WHERE userId = ?").get(req.user.id).n;
  const result = db.prepare("INSERT INTO projects (userId, name, type, createdAt, updatedAt, sortOrder, isDefault) VALUES (?, ?, ?, ?, ?, ?, 0)").run(req.user.id, name, type, t, t, sort);
  res.json(toBoolRows([db.prepare("SELECT * FROM projects WHERE id = ?").get(result.lastInsertRowid)])[0]);
});

app.patch("/api/projects/:id", auth, (req, res) => {
  const project = requireOwner("projects", req.params.id, req.user.id);
  if (!project) return res.status(404).json({ error: "项目不存在" });
  db.prepare("UPDATE projects SET name = ?, updatedAt = ? WHERE id = ?").run(String(req.body.name || project.name).trim(), now(), project.id);
  res.json(toBoolRows([db.prepare("SELECT * FROM projects WHERE id = ?").get(project.id)])[0]);
});

app.delete("/api/projects/:id", auth, (req, res) => {
  const project = requireOwner("projects", req.params.id, req.user.id);
  if (!project) return res.status(404).json({ error: "项目不存在" });
  db.prepare("DELETE FROM projects WHERE id = ?").run(project.id);
  res.json({ ok: true });
});

app.get("/api/trash", auth, (req, res) => {
  const notes = db.prepare(`SELECT notes.id, notes.title, projects.name AS projectName, notes.deletedAt, 'note' AS itemType
    FROM notes JOIN projects ON projects.id = notes.projectId WHERE notes.userId = ? AND notes.isDeleted = 1`).all(req.user.id);
  const wardrobes = db.prepare("SELECT id, title, '衣橱' AS projectName, deletedAt, 'wardrobe' AS itemType FROM wardrobes WHERE userId = ? AND isDeleted = 1").all(req.user.id);
  const plans = db.prepare("SELECT id, title, '规划' AS projectName, deletedAt, 'plan' AS itemType FROM plan_tasks WHERE userId = ? AND isDeleted = 1").all(req.user.id);
  const drawings = db.prepare("SELECT id, title, '画画' AS projectName, deletedAt, 'drawing' AS itemType FROM drawings WHERE userId = ? AND isDeleted = 1").all(req.user.id);
  res.json([...notes, ...wardrobes, ...plans, ...drawings].sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt))));
});

app.post("/api/trash/:type/:id/restore", auth, (req, res) => {
  if (req.params.type === "note") {
    const note = requireOwner("notes", req.params.id, req.user.id);
    if (!note) return res.status(404).json({ error: "笔记不存在" });
    db.prepare("UPDATE notes SET isDeleted = 0, deletedAt = NULL, updatedAt = ? WHERE id = ?").run(now(), note.id);
    return res.json({ ok: true });
  }
  if (req.params.type === "wardrobe") {
    const list = requireOwner("wardrobes", req.params.id, req.user.id);
    if (!list) return res.status(404).json({ error: "衣橱记录不存在" });
    db.prepare("UPDATE wardrobes SET isDeleted = 0, deletedAt = NULL, updatedAt = ? WHERE id = ?").run(now(), list.id);
    return res.json({ ok: true });
  }
  if (req.params.type === "plan") {
    const task = requireOwner("plan_tasks", req.params.id, req.user.id);
    if (!task) return res.status(404).json({ error: "任务不存在" });
    db.prepare("UPDATE plan_tasks SET isDeleted = 0, deletedAt = NULL, updatedAt = ? WHERE id = ?").run(now(), task.id);
    return res.json({ ok: true });
  }
  if (req.params.type === "drawing") {
    const drawing = requireOwner("drawings", req.params.id, req.user.id);
    if (!drawing) return res.status(404).json({ error: "画作不存在" });
    db.prepare("UPDATE drawings SET isDeleted = 0, deletedAt = NULL, updatedAt = ? WHERE id = ?").run(now(), drawing.id);
    return res.json({ ok: true });
  }
  res.status(400).json({ error: "不支持的垃圾箱类型" });
});

app.delete("/api/trash/:type/:id/permanent", auth, (req, res) => {
  if (req.params.type === "note") {
    const note = requireOwner("notes", req.params.id, req.user.id);
    if (!note) return res.status(404).json({ error: "笔记不存在" });
    db.prepare("DELETE FROM notes WHERE id = ?").run(note.id);
    return res.json({ ok: true });
  }
  if (req.params.type === "wardrobe") {
    const list = requireOwner("wardrobes", req.params.id, req.user.id);
    if (!list) return res.status(404).json({ error: "衣橱记录不存在" });
    db.prepare("DELETE FROM wardrobes WHERE id = ?").run(list.id);
    return res.json({ ok: true });
  }
  if (req.params.type === "plan") {
    const task = requireOwner("plan_tasks", req.params.id, req.user.id);
    if (!task) return res.status(404).json({ error: "任务不存在" });
    db.prepare("DELETE FROM plan_tasks WHERE id = ?").run(task.id);
    return res.json({ ok: true });
  }
  if (req.params.type === "drawing") {
    const drawing = requireOwner("drawings", req.params.id, req.user.id);
    if (!drawing) return res.status(404).json({ error: "画作不存在" });
    db.prepare("DELETE FROM drawings WHERE id = ?").run(drawing.id);
    fs.rmSync(path.join(uploadDir, path.basename(drawing.imageUrl)), { force: true });
    return res.json({ ok: true });
  }
  res.status(400).json({ error: "不支持的垃圾箱类型" });
});

app.get("/api/notes", auth, (req, res) => {
  const deleted = req.query.deleted === "1" ? 1 : 0;
  const favorite = req.query.favorite === "1";
  const projectId = req.query.projectId;
  let sql = "SELECT notes.*, projects.name AS projectName, projects.type AS projectType FROM notes JOIN projects ON projects.id = notes.projectId WHERE notes.userId = ? AND notes.isDeleted = ?";
  const params = [req.user.id, deleted];
  if (favorite) sql += " AND notes.isFavorite = 1";
  if (projectId) { sql += " AND notes.projectId = ?"; params.push(projectId); }
  sql += " ORDER BY notes.updatedAt DESC";
  res.json(toBoolRows(db.prepare(sql).all(...params)));
});

app.post("/api/notes", auth, (req, res) => {
  const project = requireOwner("projects", req.body.projectId, req.user.id);
  if (!project) return res.status(404).json({ error: "项目不存在" });
  const t = now();
  const result = db.prepare(`INSERT INTO notes (userId, projectId, title, content, textColor, backgroundColor, fontFamily, fontSize, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(req.user.id, project.id, req.body.title || "未命名笔记", req.body.content || "", req.body.textColor || "#4A3F55", req.body.backgroundColor || "#FFFFFF", req.body.fontFamily || "system-ui", req.body.fontSize || 16, t, t);
  res.json(toBoolRows([db.prepare("SELECT * FROM notes WHERE id = ?").get(result.lastInsertRowid)])[0]);
});

app.get("/api/notes/:id", auth, (req, res) => {
  const note = requireOwner("notes", req.params.id, req.user.id);
  if (!note) return res.status(404).json({ error: "笔记不存在" });
  const attachments = db.prepare("SELECT * FROM attachments WHERE noteId = ? ORDER BY createdAt DESC").all(note.id);
  res.json({ ...toBoolRows([note])[0], attachments });
});

app.patch("/api/notes/:id", auth, (req, res) => {
  const note = requireOwner("notes", req.params.id, req.user.id);
  if (!note) return res.status(404).json({ error: "笔记不存在" });
  const body = { ...note, ...req.body };
  db.prepare(`UPDATE notes SET title = ?, content = ?, textColor = ?, backgroundColor = ?, fontFamily = ?, fontSize = ?, updatedAt = ? WHERE id = ?`)
    .run(body.title, body.content, body.textColor, body.backgroundColor, body.fontFamily, body.fontSize, now(), note.id);
  res.json(toBoolRows([db.prepare("SELECT * FROM notes WHERE id = ?").get(note.id)])[0]);
});

app.delete("/api/notes/:id", auth, (req, res) => {
  const note = requireOwner("notes", req.params.id, req.user.id);
  if (!note) return res.status(404).json({ error: "笔记不存在" });
  db.prepare("UPDATE notes SET isDeleted = 1, deletedAt = ?, updatedAt = ? WHERE id = ?").run(now(), now(), note.id);
  res.json({ ok: true });
});

app.post("/api/notes/:id/restore", auth, (req, res) => {
  const note = requireOwner("notes", req.params.id, req.user.id);
  if (!note) return res.status(404).json({ error: "笔记不存在" });
  db.prepare("UPDATE notes SET isDeleted = 0, deletedAt = NULL, updatedAt = ? WHERE id = ?").run(now(), note.id);
  res.json({ ok: true });
});

app.delete("/api/notes/:id/permanent", auth, (req, res) => {
  const note = requireOwner("notes", req.params.id, req.user.id);
  if (!note) return res.status(404).json({ error: "笔记不存在" });
  db.prepare("DELETE FROM notes WHERE id = ?").run(note.id);
  res.json({ ok: true });
});

app.patch("/api/notes/:id/favorite", auth, (req, res) => {
  const note = requireOwner("notes", req.params.id, req.user.id);
  if (!note) return res.status(404).json({ error: "笔记不存在" });
  db.prepare("UPDATE notes SET isFavorite = CASE isFavorite WHEN 1 THEN 0 ELSE 1 END, updatedAt = ? WHERE id = ?").run(now(), note.id);
  res.json(toBoolRows([db.prepare("SELECT * FROM notes WHERE id = ?").get(note.id)])[0]);
});

app.post("/api/uploads/:type", auth, upload.single("file"), (req, res) => {
  const type = req.params.type;
  if (!["image", "audio", "drawing"].includes(type)) return res.status(400).json({ error: "不支持的上传类型" });
  const noteId = req.body.noteId || null;
  const url = `/uploads/${req.file.filename}`;
  const result = db.prepare("INSERT INTO attachments (userId, noteId, type, url, filename, size, metadata, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(req.user.id, noteId, type, url, req.file.originalname, req.file.size, req.body.metadata || null, now());
  res.json(db.prepare("SELECT * FROM attachments WHERE id = ?").get(result.lastInsertRowid));
});

app.delete("/api/attachments/:id", auth, (req, res) => {
  const item = requireOwner("attachments", req.params.id, req.user.id);
  if (!item) return res.status(404).json({ error: "附件不存在" });
  db.prepare("DELETE FROM attachments WHERE id = ?").run(item.id);
  res.json({ ok: true });
});

app.get("/api/recipes", auth, (req, res) => {
  res.json({ items: db.prepare("SELECT * FROM recipe_items WHERE userId = ? ORDER BY id").all(req.user.id), draws: db.prepare("SELECT * FROM recipe_draws WHERE userId = ? ORDER BY createdAt DESC LIMIT 10").all(req.user.id) });
});

app.post("/api/recipes", auth, (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "食物名称不能为空" });
  const t = now();
  const result = db.prepare("INSERT INTO recipe_items (userId, name, createdAt, updatedAt) VALUES (?, ?, ?, ?)").run(req.user.id, name, t, t);
  res.json(db.prepare("SELECT * FROM recipe_items WHERE id = ?").get(result.lastInsertRowid));
});

app.delete("/api/recipes/:id", auth, (req, res) => {
  const item = requireOwner("recipe_items", req.params.id, req.user.id);
  if (!item) return res.status(404).json({ error: "食物不存在" });
  db.prepare("DELETE FROM recipe_items WHERE id = ?").run(item.id);
  res.json({ ok: true });
});

app.post("/api/recipes/random", auth, (req, res) => {
  const items = db.prepare("SELECT * FROM recipe_items WHERE userId = ? ORDER BY id").all(req.user.id);
  if (!items.length) return res.status(400).json({ error: "食物列表为空" });
  const index = Math.floor(Math.random() * items.length);
  const item = items[index];
  const t = now();
  db.prepare("INSERT INTO recipe_draws (userId, itemId, itemName, itemNumber, total, createdAt) VALUES (?, ?, ?, ?, ?, ?)").run(req.user.id, item.id, item.name, index + 1, items.length, t);
  res.json({ item, number: index + 1, total: items.length, createdAt: t });
});

app.get("/api/wardrobes", auth, (req, res) => {
  const lists = db.prepare("SELECT * FROM wardrobes WHERE userId = ? AND isDeleted = 0 ORDER BY updatedAt DESC").all(req.user.id);
  const sections = db.prepare(`SELECT wardrobe_sections.* FROM wardrobe_sections
    JOIN wardrobes ON wardrobes.id = wardrobe_sections.wardrobeListId
    WHERE wardrobes.userId = ? AND wardrobes.isDeleted = 0
    ORDER BY wardrobe_sections.wardrobeListId,
      CASE wardrobe_sections.sectionType
        WHEN 'head' THEN 1
        WHEN 'face' THEN 2
        WHEN 'top' THEN 3
        WHEN 'bottom' THEN 4
        WHEN 'feet' THEN 5
        ELSE 99
      END`).all(req.user.id);
  res.json(lists.map((list) => ({ ...list, sections: sections.filter((s) => s.wardrobeListId === list.id) })));
});

app.post("/api/wardrobes", auth, (req, res) => {
  const t = now();
  const result = db.prepare("INSERT INTO wardrobes (userId, title, createdAt, updatedAt) VALUES (?, ?, ?, ?)").run(req.user.id, req.body.title || "新的衣橱记录", t, t);
  const insert = db.prepare("INSERT INTO wardrobe_sections (wardrobeListId, sectionType, createdAt, updatedAt) VALUES (?, ?, ?, ?)");
  wardrobeSections.forEach((s) => insert.run(result.lastInsertRowid, s, t, t));
  res.json({ id: result.lastInsertRowid });
});

app.patch("/api/wardrobes/:id", auth, (req, res) => {
  const list = requireOwner("wardrobes", req.params.id, req.user.id);
  if (!list) return res.status(404).json({ error: "衣橱记录不存在" });
  db.prepare("UPDATE wardrobes SET title = ?, updatedAt = ? WHERE id = ?").run(req.body.title || list.title, now(), list.id);
  if (Array.isArray(req.body.sections)) {
    const update = db.prepare("UPDATE wardrobe_sections SET text = ?, imageUrl = ?, updatedAt = ? WHERE id = ? AND wardrobeListId = ?");
    req.body.sections.forEach((s) => update.run(s.text || "", s.imageUrl || null, now(), s.id, list.id));
  }
  res.json({ ok: true });
});

app.patch("/api/wardrobes/:id/favorite", auth, (req, res) => {
  const list = requireOwner("wardrobes", req.params.id, req.user.id);
  if (!list) return res.status(404).json({ error: "衣橱记录不存在" });
  db.prepare("UPDATE wardrobes SET isFavorite = ?, updatedAt = ? WHERE id = ?").run(list.isFavorite ? 0 : 1, now(), list.id);
  res.json(toBoolRows([db.prepare("SELECT * FROM wardrobes WHERE id = ?").get(list.id)])[0]);
});

app.delete("/api/wardrobes/:id", auth, (req, res) => {
  const list = requireOwner("wardrobes", req.params.id, req.user.id);
  if (!list) return res.status(404).json({ error: "衣橱记录不存在" });
  db.prepare("UPDATE wardrobes SET isDeleted = 1, deletedAt = ?, updatedAt = ? WHERE id = ?").run(now(), now(), list.id);
  res.json({ ok: true });
});

app.get("/api/plans", auth, (req, res) => res.json(toBoolRows(db.prepare("SELECT * FROM plan_tasks WHERE userId = ? AND isDeleted = 0 ORDER BY startDate").all(req.user.id))));
app.post("/api/plans", auth, (req, res) => {
  const t = now();
  const result = db.prepare("INSERT INTO plan_tasks (userId, title, startDate, endDate, color, note, isDone, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(req.user.id, req.body.title || "新任务", req.body.startDate, req.body.endDate, req.body.color || "#CDB4DB", req.body.note || "", req.body.isDone ? 1 : 0, t, t);
  res.json(toBoolRows([db.prepare("SELECT * FROM plan_tasks WHERE id = ?").get(result.lastInsertRowid)])[0]);
});
app.patch("/api/plans/:id", auth, (req, res) => {
  const task = requireOwner("plan_tasks", req.params.id, req.user.id);
  if (!task) return res.status(404).json({ error: "任务不存在" });
  const body = { ...task, ...req.body };
  db.prepare("UPDATE plan_tasks SET title = ?, startDate = ?, endDate = ?, color = ?, note = ?, isDone = ?, updatedAt = ? WHERE id = ?")
    .run(body.title, body.startDate, body.endDate, body.color, body.note, body.isDone ? 1 : 0, now(), task.id);
  res.json(toBoolRows([db.prepare("SELECT * FROM plan_tasks WHERE id = ?").get(task.id)])[0]);
});
app.patch("/api/plans/:id/favorite", auth, (req, res) => {
  const task = requireOwner("plan_tasks", req.params.id, req.user.id);
  if (!task) return res.status(404).json({ error: "任务不存在" });
  db.prepare("UPDATE plan_tasks SET isFavorite = ?, updatedAt = ? WHERE id = ?").run(task.isFavorite ? 0 : 1, now(), task.id);
  res.json(toBoolRows([db.prepare("SELECT * FROM plan_tasks WHERE id = ?").get(task.id)])[0]);
});
app.delete("/api/plans/:id", auth, (req, res) => {
  const task = requireOwner("plan_tasks", req.params.id, req.user.id);
  if (!task) return res.status(404).json({ error: "任务不存在" });
  db.prepare("UPDATE plan_tasks SET isDeleted = 1, deletedAt = ?, updatedAt = ? WHERE id = ?").run(now(), now(), task.id);
  res.json({ ok: true });
});

app.get("/api/drawings", auth, (req, res) => res.json(toBoolRows(db.prepare("SELECT * FROM drawings WHERE userId = ? AND isDeleted = 0 ORDER BY updatedAt DESC").all(req.user.id))));
app.post("/api/drawings", auth, (req, res) => {
  const imageData = String(req.body.imageData || "");
  const match = imageData.match(/^data:image\/png;base64,(.+)$/);
  if (!match) return res.status(400).json({ error: "画作数据无效" });
  const filename = `${Date.now()}-${crypto.randomUUID()}.png`;
  fs.writeFileSync(path.join(uploadDir, filename), Buffer.from(match[1], "base64"));
  const t = now();
  const result = db.prepare("INSERT INTO drawings (userId, title, imageUrl, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)").run(req.user.id, req.body.title || "未命名画作", `/uploads/${filename}`, t, t);
  res.json(db.prepare("SELECT * FROM drawings WHERE id = ?").get(result.lastInsertRowid));
});
app.delete("/api/drawings/:id", auth, (req, res) => {
  const item = requireOwner("drawings", req.params.id, req.user.id);
  if (!item) return res.status(404).json({ error: "画作不存在" });
  db.prepare("UPDATE drawings SET isDeleted = 1, deletedAt = ?, updatedAt = ? WHERE id = ?").run(now(), now(), item.id);
  res.json({ ok: true });
});

app.patch("/api/drawings/:id/favorite", auth, (req, res) => {
  const item = requireOwner("drawings", req.params.id, req.user.id);
  if (!item) return res.status(404).json({ error: "画作不存在" });
  db.prepare("UPDATE drawings SET isFavorite = ?, updatedAt = ? WHERE id = ?").run(item.isFavorite ? 0 : 1, now(), item.id);
  res.json(toBoolRows([db.prepare("SELECT * FROM drawings WHERE id = ?").get(item.id)])[0]);
});

app.get("/api/favorites", auth, (req, res) => {
  const notes = db.prepare(`SELECT notes.id, notes.projectId, projects.name AS projectName, projects.type AS projectType,
    notes.title, notes.content, notes.createdAt, notes.updatedAt, 'note' AS itemType
    FROM notes JOIN projects ON projects.id = notes.projectId
    WHERE notes.userId = ? AND notes.isFavorite = 1 AND notes.isDeleted = 0`).all(req.user.id);
  const wardrobes = db.prepare(`SELECT id, title, createdAt, updatedAt, 'wardrobe' AS itemType, 'wardrobe' AS projectType
    FROM wardrobes WHERE userId = ? AND isFavorite = 1 AND isDeleted = 0`).all(req.user.id);
  const plans = db.prepare(`SELECT id, title, note AS content, createdAt, updatedAt, 'plan' AS itemType, 'plan' AS projectType
    FROM plan_tasks WHERE userId = ? AND isFavorite = 1 AND isDeleted = 0`).all(req.user.id);
  const drawings = db.prepare(`SELECT id, title, imageUrl, createdAt, updatedAt, 'drawing' AS itemType, 'drawing' AS projectType
    FROM drawings WHERE userId = ? AND isFavorite = 1 AND isDeleted = 0`).all(req.user.id);
  res.json([...notes, ...wardrobes, ...plans, ...drawings].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))));
});

app.get("/api/secrets", auth, (req, res) => {
  const rows = db.prepare(`SELECT notes.id, notes.title, notes.content, notes.createdAt, notes.updatedAt, users.username
    FROM notes JOIN projects ON projects.id = notes.projectId JOIN users ON users.id = notes.userId
    WHERE projects.type = 'secret' AND notes.isDeleted = 0 ORDER BY notes.updatedAt DESC`).all();
  res.json(rows);
});

if (isProd) {
  app.use(express.static(path.join(rootDir, "dist")));
  app.get("*", (_, res) => res.sendFile(path.join(rootDir, "dist", "index.html")));
}

app.listen(port, () => {
  console.log(`Nancy server listening on ${isProd ? appOrigin : `http://localhost:${port}`}`);
});
