import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowLeft, Brush, CalendarDays, ChefHat, ChevronDown, ChevronUp, Download, Heart, Image, ListTodo, LogOut, Menu, Mic, PenLine, Plus, RotateCcw, Save, Search, Shirt, Star, Trash2, UserRound, X } from "lucide-react";
import "./styles.css";

const api = async (url, options = {}) => {
  const res = await fetch(url, {
    credentials: "include",
    headers: options.body instanceof FormData ? {} : { "Content-Type": "application/json" },
    ...options,
    body: options.body instanceof FormData ? options.body : options.body ? JSON.stringify(options.body) : undefined
  });
  if (res.status === 401) window.dispatchEvent(new Event("nancy-auth-expired"));
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "请求失败");
  return res.json();
};

const fmt = (value) => value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "";
const today = () => new Date().toISOString().slice(0, 10);
const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
const success = () => window.alert("操作成功！");
const confirmDelete = () => window.confirm("确定要删除吗？");
const emptyText = "这里还空空如也哦～";
const emptyRecipeData = { items: [], draws: [] };
const privateGateKey = "nancy-private-gate-expires-at";
const privateGateDuration = 2 * 60 * 60 * 1000;

function App() {
  const [checked, setChecked] = useState(() => Number(localStorage.getItem(privateGateKey)) > Date.now());
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!checked) {
      setUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    api("/api/me").then((d) => setUser(d.user)).catch(() => setUser(null)).finally(() => setLoading(false));
  }, [checked]);

  useEffect(() => {
    // 未登录时 /api/me 也会返回 401；这不代表入口问答已过期。
    // 两小时到期由下面的定时器统一处理。
    const expire = () => setUser(null);
    window.addEventListener("nancy-auth-expired", expire);
    return () => window.removeEventListener("nancy-auth-expired", expire);
  }, []);
  useEffect(() => {
    if (!checked) return undefined;
    const remaining = Number(localStorage.getItem(privateGateKey)) - Date.now();
    if (remaining <= 0) {
      setChecked(false);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      localStorage.removeItem(privateGateKey);
      setUser(null);
      setChecked(false);
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [checked]);

  if (!checked) return <PrivateCheck onDone={() => { localStorage.setItem(privateGateKey, String(Date.now() + privateGateDuration)); setChecked(true); }} />;
  if (loading) return <Splash text="正在打开小奶昔的网站..." />;
  if (!user) return <Auth onAuthed={setUser} />;
  return <Shell user={user} setUser={setUser} />;
}

function Splash({ text }) {
  return <main className="gate"><div className="gate-panel"><h1>{text}</h1></div></main>;
}

function PrivateCheck({ onDone }) {
  const questions = [
    { text: "1. 世界上最最最可爱的人是？", answers: ["奶昔","我", "小奶昔", "昔", "昔昔", "陈静宜", "静宜", "西米", "昔米", "昔咪"], ok: "对啦！", fail: "不对啦！", strict: true },
    { text: "2. 今天开不开心？", answers: ["开心", "嗯嗯", "yes"], ok: "好耶！o(^▽^)o", fail: "抱抱奶昔(´･ω･`)", strict: false, exact: true },
    { text: "3. 我是谁呀？", answers: ["奶茶", "茶", "茶茶", "张佳琪", "佳琪", "tea", "zjq"], ok: "欢迎奶昔～这里是奶昔的小世界", fail: "go awayyyyyy!!这是奶昔的私人网站", strict: true },
    { text: "4. 暗号是什么？", answers: ["123Qiaokeli"], ok: "暗号正确，正在进入…", fail: "暗号错误！", strict: true, exact: true, password: true }
  ];
  const [step, setStep] = useState(0);
  const [answer, setAnswer] = useState("");
  const [msg, setMsg] = useState("");
  const q = questions[step];
  const submit = (e) => {
    e.preventDefault();
    const value = answer.trim();
    // 第二题必须完整匹配，避免“不开心”因为包含“开心”而被误判；暗号区分大小写。
    const comparable = q.password ? value : value.toLowerCase();
    const pass = q.answers.some((a) => q.exact ? comparable === (q.password ? a : a.toLowerCase()) : comparable.includes(a.toLowerCase()));
    setMsg(pass ? q.ok : q.fail);
    if (pass || !q.strict) {
      setTimeout(() => {
        if (step === questions.length - 1) onDone();
        else { setStep(step + 1); setAnswer(""); setMsg(""); }
      }, 1300);
    }
  };
  return <main className="gate">
    <form className="gate-panel qa-panel" onSubmit={submit}>
      <span className="eyebrow">Q&A</span>
      <h2>这是小奶昔的网站！</h2>
      <h1>{q.text}</h1>
    <input autoFocus type={q.password ? "password" : "text"} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={q.password ? "请输入暗号" : "悄悄写在这里"} />
      <button>回答</button>
      {msg && <p className="feedback">{msg}</p>}
    </form>
  </main>;
}

function Auth({ onAuthed }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const data = await api(`/api/auth/${mode}`, { method: "POST", body: form });
      onAuthed(data.user);
    } catch (err) { setError(err.message); }
  };
  return <main className="gate">
    <form className="gate-panel auth" onSubmit={submit}>
      <span className="eyebrow">{mode === "login" ? "登录" : "注册"}账号</span>
      <h1>这是小奶昔的网站！</h1>
      <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="用户名" />
      <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="密码" />
      <button>{mode === "login" ? "登录" : "注册"}</button>
      {error && <p className="error">{error}</p>}
      <button className="ghost" type="button" onClick={() => setMode(mode === "login" ? "register" : "login")}>
        {mode === "login" ? "还没有账号，去注册" : "已有账号，去登录"}
      </button>
    </form>
  </main>;
}

function Shell({ user, setUser }) {
  const [tab, setTab] = useState("tools");
  const [visitedTabs, setVisitedTabs] = useState(() => new Set(["tools"]));
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [toolsResetVersion, setToolsResetVersion] = useState(0);
  const [toolsOpenVersion, setToolsOpenVersion] = useState(0);
  const projectLoadSeq = useRef(0);
  const activeProject = projects.find((item) => item.id === activeProjectId) || null;
  const loadProjects = useCallback(async (preferredId) => {
    const seq = projectLoadSeq.current + 1;
    projectLoadSeq.current = seq;
    try {
      const rows = await api("/api/projects");
      if (seq !== projectLoadSeq.current) return rows;
      setProjects(rows);
      setActiveProjectId((currentId) => {
        if (preferredId && rows.some((item) => item.id === preferredId)) return preferredId;
        if (currentId && rows.some((item) => item.id === currentId)) return currentId;
        return rows[0]?.id || null;
      });
      return rows;
    } catch {
      if (seq === projectLoadSeq.current) setUser(null);
      return [];
    }
  }, [setUser]);
  useEffect(() => { void loadProjects(); }, [loadProjects]);
  const navigate = useCallback((nextTab, preserveToolsView = false) => {
    if (nextTab === "tools" && !preserveToolsView) setToolsResetVersion((version) => version + 1);
    setVisitedTabs((current) => current.has(nextTab) ? current : new Set([...current, nextTab]));
    setTab(nextTab);
  }, []);
  const nav = [
    ["tools", "工具栏", Menu],
    ["favorites", "收藏夹", Heart],
    ["trash", "垃圾箱", Trash2],
    ["accounts", "账号管理", UserRound]
  ];
  return <div className="app-shell">
    <aside className="sidebar">
      <h1>这是小奶昔的网站！</h1>
      <p>{user.username}</p>
      <nav>{nav.map(([id, label, Icon]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => navigate(id)}><Icon size={18} />{label}</button>)}</nav>
    </aside>
    <main className="workspace">
      {visitedTabs.has("tools") && <TabPanel active={tab === "tools"}><Tools projects={projects} activeProject={activeProject} setActiveProjectId={setActiveProjectId} reload={loadProjects} mobileResetVersion={toolsResetVersion} mobileOpenVersion={toolsOpenVersion} /></TabPanel>}
      {visitedTabs.has("favorites") && <TabPanel active={tab === "favorites"}><Favorites active={tab === "favorites"} projects={projects} openProject={(projectId) => { setActiveProjectId(projectId); setToolsOpenVersion((version) => version + 1); navigate("tools", true); }} /></TabPanel>}
      {visitedTabs.has("trash") && <TabPanel active={tab === "trash"}><Trash active={tab === "trash"} /></TabPanel>}
      {visitedTabs.has("accounts") && <TabPanel active={tab === "accounts"}><Accounts user={user} setUser={setUser} /></TabPanel>}
    </main>
    <nav className="bottom-nav">{nav.map(([id, label, Icon]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => navigate(id)}><Icon size={20} /><span>{label}</span></button>)}</nav>
  </div>;
}

function TabPanel({ active, children }) {
  return <div className="tab-panel" hidden={!active}>{children}</div>;
}

function Tools({ projects, activeProject, setActiveProjectId, reload, mobileResetVersion, mobileOpenVersion }) {
  const [recoveryVersion, setRecoveryVersion] = useState(0);
  const [mobileProjectOpen, setMobileProjectOpen] = useState(false);
  useEffect(() => { setMobileProjectOpen(false); }, [mobileResetVersion]);
  useEffect(() => { if (mobileOpenVersion) setMobileProjectOpen(true); }, [mobileOpenVersion]);
  const createProject = async () => {
    const name = prompt("项目文件夹名称");
    if (!name?.trim()) return;
    const project = await api("/api/projects", { method: "POST", body: { name, type: "custom" } });
    success();
    await reload(project.id);
    setMobileProjectOpen(true);
  };
  const rename = async (project) => {
    const next = prompt("项目名称", project.name);
    if (next?.trim()) { await api(`/api/projects/${project.id}`, { method: "PATCH", body: { name: next } }); success(); await reload(project.id); }
  };
  const remove = async (project) => {
    if (confirmDelete()) { await api(`/api/projects/${project.id}`, { method: "DELETE" }); success(); await reload(); }
  };
  const openProject = (projectId) => {
    setActiveProjectId(projectId);
    setMobileProjectOpen(true);
  };
  return <section className={`tools-grid ${mobileProjectOpen ? "mobile-project-open" : ""}`}>
    <div className="project-list">
      <div className="section-head"><h2>工具栏</h2></div>
      <div className="new-folder-row"><span>新建项目文件夹</span><button type="button" title="新建项目文件夹" onClick={createProject}><Plus size={18} /></button></div>
      {projects.map((p) => <button type="button" key={p.id} className={`project-pill ${activeProject?.id === p.id ? "active" : ""}`} onClick={() => openProject(p.id)}>
        <ProjectIcon type={p.type} /> <span>{p.name}</span>
      </button>)}
    </div>
    <div className="content-pane"><button type="button" className="mobile-project-back ghost" onClick={() => setMobileProjectOpen(false)}>← 返回工具栏</button>{activeProject ? <ProjectContentBoundary key={`${activeProject.id}-${recoveryVersion}`} onRetry={() => setRecoveryVersion((version) => version + 1)}><ProjectView project={activeProject} onRename={() => rename(activeProject)} onDelete={() => remove(activeProject)} /></ProjectContentBoundary> : <Empty text="请选择或新建项目" />}</div>
  </section>;
}

function ProjectIcon({ type }) {
  const map = { diary: PenLine, recipe: ChefHat, wardrobe: Shirt, plan: CalendarDays, drawing: Brush, secret: Heart };
  const Icon = map[type] || ListTodo;
  return <Icon size={18} />;
}

function ProjectTitle({ title, onRename, onDelete, children }) {
  return <div className="section-head project-title">
    <h2>{title}</h2>
    <div className="title-actions">
      {children}
      <button title="重命名" onClick={onRename}><PenLine size={18} /></button>
      <button className="danger" title="删除" onClick={onDelete}><Trash2 size={18} /></button>
    </div>
  </div>;
}

// 项目内容中的运行错误只影响当前内容区，不能让整个应用变成空白页。
class ProjectContentBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return <div className="project-recovery"><p>这个项目暂时没有加载成功。</p><button type="button" onClick={this.props.onRetry}>重新打开项目</button></div>;
    return this.props.children;
  }
}

class AppBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return <main className="gate"><div className="gate-panel"><h2>页面没有加载成功</h2><p>请重新打开页面；你的数据不会丢失。</p><button type="button" onClick={() => window.location.reload()}>重新打开</button></div></main>;
    return this.props.children;
  }
}

function ProjectView({ project, onRename, onDelete }) {
  if (project.type === "recipe") return <Recipes project={project} onRename={onRename} onDelete={onDelete} />;
  if (project.type === "wardrobe") return <Wardrobe project={project} onRename={onRename} onDelete={onDelete} />;
  if (project.type === "plan") return <Plans project={project} onRename={onRename} onDelete={onDelete} />;
  if (project.type === "drawing") return <DrawingBoard project={project} onRename={onRename} onDelete={onDelete} />;
  return <Notes project={project} secret={project.type === "secret"} onRename={onRename} onDelete={onDelete} />;
}

function Notes({ project, secret = false, onRename, onDelete }) {
  const [notes, setNotes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [query, setQuery] = useState("");
  const load = useCallback(async () => {
    try {
      const rows = await api(`/api/notes?projectId=${project.id}`);
      setNotes(Array.isArray(rows) ? rows : []);
    } catch {
      setNotes([]);
    }
  }, [project.id]);
  useEffect(() => {
    let cancelled = false;
    setSelected(null);
    setDetail(null);
    api(`/api/notes?projectId=${project.id}`).then((rows) => {
      if (!cancelled) setNotes(Array.isArray(rows) ? rows : []);
    }).catch(() => {
      if (!cancelled) setNotes([]);
    });
    return () => { cancelled = true; };
  }, [project.id]);
  useEffect(() => { if (selected) api(`/api/notes/${selected}`).then(setDetail).catch(() => { setSelected(null); setDetail(null); }); }, [selected]);
  const create = async (inlineTitle) => {
    const title = inlineTitle === undefined ? prompt(secret ? "悄悄话标题" : "笔记标题") : inlineTitle;
    if (!title?.trim()) return;
    const note = await api("/api/notes", { method: "POST", body: { projectId: project.id, title } });
    success();
    await load();
    setSelected(note.id);
    window.dispatchEvent(new Event("nancy-data-updated"));
  };
  const filtered = notes.filter((n) => (n.title + n.content).includes(query));
  if (detail) return <section className={`note-detail-page ${secret ? "secret-zone" : ""}`}>
    <ProjectTitle title={detail.title || project.name} onRename={onRename} onDelete={onDelete}>
      <button type="button" title="返回笔记列表" onClick={() => { setDetail(null); setSelected(null); }}><ArrowLeft size={18} /></button>
    </ProjectTitle>
    <NoteEditor note={detail} onSaved={() => { void load(); api(`/api/notes/${detail.id}`).then(setDetail).catch(() => {}); }} onDeleted={() => { setDetail(null); setSelected(null); void load(); }} />
  </section>;
  return <section className={`note-list-page ${secret ? "secret-zone" : ""}`}>
    <div className="note-list">
      <ProjectTitle title={project.name} onRename={onRename} onDelete={onDelete}><button title="新增" onClick={() => create()}><Plus size={18} /></button></ProjectTitle>
      {secret && <p className="fixed-copy">想对奶茶说什么？新增功能or分享生活都是ok的！<br />（PS:只有写在这的内容，我才看得见哦～其它都是奶昔的秘密！）</p>}
      <label className="search"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索笔记" /></label>
      {!filtered.length && <Empty text={emptyText} />}
      {filtered.map((n) => <article key={n.id} className="note-card" onClick={() => setSelected(n.id)}>
        <button className="star" onClick={async (e) => { e.stopPropagation(); await api(`/api/notes/${n.id}/favorite`, { method: "PATCH" }); success(); load(); }}>{n.isFavorite ? "★" : "☆"}</button>
        <h3>{n.title}</h3>
        <p className="note-preview">{secret ? "点击查看内容" : n.content || "还没有正文"}</p>
        <small>创建：{fmt(n.createdAt)}</small>
      </article>)}
    </div>
  </section>;
}

function NoteEditor({ note, onSaved, onDeleted }) {
  const [form, setForm] = useState(note);
  const [recording, setRecording] = useState(false);
  const [contentHeight, setContentHeight] = useState(() => Math.max(240, Math.min(520, window.innerHeight * 0.45)));
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const formRef = useRef(note);
  const resizeRef = useRef(null);
  const draftKey = `nancy-note-draft-${note.id}`;
  useEffect(() => {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(draftKey) || "null"); } catch {}
    const next = saved ? { ...note, ...saved } : note;
    formRef.current = next;
    setForm(next);
  }, [note.id]);
  useEffect(() => {
    formRef.current = form;
    localStorage.setItem(draftKey, JSON.stringify(form));
    const timer = window.setTimeout(() => {
      api(`/api/notes/${note.id}`, { method: "PATCH", body: form }).then(() => localStorage.removeItem(draftKey)).catch(() => {});
    }, 800);
    return () => window.clearTimeout(timer);
  }, [form, note.id]);
  useEffect(() => {
    const preserveDraft = () => localStorage.setItem(draftKey, JSON.stringify(formRef.current));
    const onVisibilityChange = () => { if (document.visibilityState === "hidden") preserveDraft(); };
    window.addEventListener("pagehide", preserveDraft);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", preserveDraft);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [draftKey]);
  const save = async () => {
    try {
      await api(`/api/notes/${note.id}`, { method: "PATCH", body: form });
      localStorage.removeItem(draftKey);
      success();
      onSaved();
      window.dispatchEvent(new Event("nancy-data-updated"));
    } catch (error) {
      window.alert(`保存失败：${error.message}`);
    }
  };
  const del = async () => {
    if (!confirmDelete()) return;
    try {
      await api(`/api/notes/${note.id}`, { method: "DELETE" });
      localStorage.removeItem(draftKey);
      success();
      onDeleted();
      window.dispatchEvent(new Event("nancy-data-updated"));
    } catch (error) {
      window.alert(`删除失败：${error.message}`);
    }
  };
  const upload = async (file, type) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("noteId", note.id);
    await api(`/api/uploads/${type}`, { method: "POST", body: fd });
    onSaved();
  };
  const startRecord = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const media = new MediaRecorder(stream);
    mediaRef.current = media;
    chunksRef.current = [];
    media.ondataavailable = (e) => chunksRef.current.push(e.data);
    media.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      upload(new File([new Blob(chunksRef.current, { type: "audio/webm" })], `record-${Date.now()}.webm`, { type: "audio/webm" }), "audio");
    };
    media.start();
    setRecording(true);
  };
  const stopRecord = () => { mediaRef.current?.stop(); setRecording(false); };
  const beginResize = (event) => {
    event.preventDefault();
    resizeRef.current = { startY: event.clientY, startHeight: contentHeight };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const resizeContent = (event) => {
    if (!resizeRef.current) return;
    const maxHeight = Math.max(240, window.innerHeight * 0.75);
    setContentHeight(Math.max(180, Math.min(maxHeight, resizeRef.current.startHeight + event.clientY - resizeRef.current.startY)));
  };
  const endResize = (event) => {
    resizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return <div className="editor">
    <input className="title-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
    <div className="format-row">
      <input className="color-picker" type="color" value={form.textColor} onChange={(e) => setForm({ ...form, textColor: e.target.value })} title="文本颜色" />
      <input className="color-picker" type="color" value={form.backgroundColor} onChange={(e) => setForm({ ...form, backgroundColor: e.target.value })} title="背景颜色" />
      <select value={form.fontFamily} onChange={(e) => setForm({ ...form, fontFamily: e.target.value })}><option value="system-ui">默认</option><option value="serif">衬线</option><option value="monospace">等宽</option><option value="cursive">手写</option></select>
      <input type="number" min="12" max="32" value={form.fontSize} onChange={(e) => setForm({ ...form, fontSize: Number(e.target.value) })} />
      <label className="icon-upload"><Image size={18} /><input type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && upload(e.target.files[0], "image")} /></label>
      <label className="icon-upload"><Mic size={18} /><input type="file" accept="audio/*" hidden onChange={(e) => e.target.files[0] && upload(e.target.files[0], "audio")} /></label>
      <button onClick={recording ? stopRecord : startRecord}><Mic size={18} />{recording ? "停止" : "录音"}</button>
    </div>
    <div className="note-content-resizable">
      <textarea style={{ color: form.textColor, background: form.backgroundColor, fontFamily: form.fontFamily, fontSize: `${form.fontSize}px`, height: `${contentHeight}px` }} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
      <div className="textarea-resize-handle" role="separator" aria-orientation="horizontal" aria-label="调整文本框高度" tabIndex="0" onPointerDown={beginResize} onPointerMove={resizeContent} onPointerUp={endResize} onPointerCancel={endResize} onKeyDown={(event) => { if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); setContentHeight((height) => Math.max(180, Math.min(Math.max(240, window.innerHeight * 0.75), height + (event.key === "ArrowUp" ? -24 : 24)))); } }} />
    </div>
    <div className="attachments">{form.attachments?.map((a) => <div key={a.id} className="attachment">
      {a.type === "image" ? <img src={a.url} /> : <audio controls src={a.url} />}
      <button onClick={async () => { if (confirmDelete()) { await api(`/api/attachments/${a.id}`, { method: "DELETE" }); success(); onSaved(); } }}><X size={16} /></button>
    </div>)}</div>
    <div className="actions"><button onClick={save}><Save size={18} />保存</button><button className="danger" onClick={del}><Trash2 size={18} />删除</button></div>
    <small>创建：{fmt(note.createdAt)}</small>
  </div>;
}

function Favorites({ active, projects, openProject }) {
  const [notes, setNotes] = useState([]);
  const [filter, setFilter] = useState("");
  const load = () => api("/api/favorites").then(setNotes);
  useEffect(() => {
    if (active) load();
  }, [active]);
  useEffect(() => {
    const refresh = () => load();
    window.addEventListener("nancy-data-updated", refresh);
    return () => window.removeEventListener("nancy-data-updated", refresh);
  }, []);
  const availableProjects = projects.filter((p) => p.type !== "recipe");
  const rows = filter ? notes.filter((item) => String(item.projectId) === filter || projects.find((p) => String(p.id) === filter)?.type === item.projectType) : notes;
  const unfavorite = async (item) => {
    const endpoint = item.itemType === "note" ? `/api/notes/${item.id}/favorite` : `/api/${item.itemType === "wardrobe" ? "wardrobes" : `${item.itemType}s`}/${item.id}/favorite`;
    await api(endpoint, { method: "PATCH" });
    success();
    load();
  };
  const openItem = (item) => {
    const project = item.itemType === "note" ? projects.find((p) => p.id === item.projectId) : projects.find((p) => p.type === item.projectType);
    if (project) openProject(project.id);
  };
  const projectFolder = (item) => item.projectName || projects.find((p) => p.type === item.projectType)?.name || "未分类项目";
  return <section><div className="section-head favorites-head"><h2>收藏夹</h2><select className="favorites-filter" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">全部项目</option>{availableProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
    {!rows.length && <Empty text={emptyText} />}
    <div className="cards">{rows.map((item) => <article className="note-card" key={`${item.itemType}-${item.id}`}><button className="star" onClick={() => unfavorite(item)}>★</button><h3>{item.title}</h3>{item.imageUrl ? <img className="favorite-image" src={item.imageUrl} alt={item.title} /> : <p className="note-preview">{item.content || "暂无内容"}</p>}<small>{projectFolder(item)} · 更新：{fmt(item.updatedAt)}</small><button onClick={() => openItem(item)}>进入原项目</button></article>)}</div>
  </section>;
}

function Trash({ active }) {
  const [items, setItems] = useState([]);
  const load = () => api("/api/trash").then(setItems);
  useEffect(() => { if (active) load(); }, [active]);
  const remain = (deletedAt) => Math.max(0, 3 - Math.floor((Date.now() - new Date(deletedAt).getTime()) / 86400000));
  return <section><div className="section-head"><h2>垃圾箱</h2></div>
    {!items.length && <Empty text={emptyText} />}
    <div className="cards">{items.map((n) => <article className="note-card" key={`${n.itemType}-${n.id}`}><h3>{n.title}</h3>{n.imageUrl ? <img className="trash-image" src={n.imageUrl} alt={n.title} /> : <p>{n.projectName}</p>}<small>删除：{fmt(n.deletedAt)} · 剩余约 {remain(n.deletedAt)} 天</small><button onClick={async () => { await api(`/api/trash/${n.itemType}/${n.id}/restore`, { method: "POST" }); success(); load(); }}>恢复</button><button className="danger" onClick={async () => { if (confirmDelete()) { await api(`/api/trash/${n.itemType}/${n.id}/permanent`, { method: "DELETE" }); success(); load(); } }}>永久删除</button></article>)}</div>
  </section>;
}

function Recipes({ project, onRename, onDelete }) {
  const [data, setData] = useState(emptyRecipeData);
  const [result, setResult] = useState(null);
  const [menuExpanded, setMenuExpanded] = useState(false);
  const load = useCallback(async () => {
    try {
      const next = await api("/api/recipes");
      setData({ items: Array.isArray(next.items) ? next.items : [], draws: Array.isArray(next.draws) ? next.draws : [] });
    } catch {
      setData(emptyRecipeData);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const addFood = async () => {
    const next = prompt("新增食物名称");
    if (!next?.trim()) return;
    await api("/api/recipes", { method: "POST", body: { name: next } });
    success();
    load();
  };
  return <section className="feature"><ProjectTitle title={project.name} onRename={onRename} onDelete={onDelete}><button title="新增食物" onClick={addFood}><Plus size={18} /></button></ProjectTitle>
    <div className="recipe-result">{result ? `${result.number} 号，${result.item.name}` : `当前共有 ${data.items.length} 个食物`}</div>
    <button onClick={async () => { setResult(await api("/api/recipes/random", { method: "POST" })); load(); }}>随机抽取</button>
    {!data.items.length && <Empty text={emptyText} />}
    <div className="chips">{data.items.slice(0, menuExpanded ? data.items.length : 5).map((i, idx) => <span key={i.id}>{idx + 1}. {i.name}<button onClick={async () => { if (confirmDelete()) { await api(`/api/recipes/${i.id}`, { method: "DELETE" }); success(); load(); } }}>×</button></span>)}</div>
    {data.items.length > 5 && <button className="ghost menu-toggle" onClick={() => setMenuExpanded((expanded) => !expanded)}>{menuExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}{menuExpanded ? "收起菜单" : `展开全部（共 ${data.items.length} 项）`}</button>}
    <h3>最近抽取</h3>{!data.draws.length && <Empty text={emptyText} />}{data.draws.map((d) => <p key={d.id}>{d.itemNumber} 号，{d.itemName} <small>{fmt(d.createdAt)}</small></p>)}
  </section>;
}

function Wardrobe({ project, onRename, onDelete }) {
  const labels = { head: "头部", face: "面部", top: "上身", bottom: "下身", feet: "足部" };
  const [lists, setLists] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [dirtyVersion, setDirtyVersion] = useState(0);
  const wardrobeDraftKey = `nancy-wardrobe-draft-${project.id}`;
  const load = useCallback(async () => {
    try {
      const next = await api("/api/wardrobes");
      let draft = null;
      try { draft = JSON.parse(localStorage.getItem(wardrobeDraftKey) || "null"); } catch {}
      setLists(Array.isArray(draft) ? draft : (Array.isArray(next) ? next : []));
      if (Array.isArray(draft)) setDirtyVersion((version) => version + 1);
    } catch {
      setLists([]);
    }
  }, [wardrobeDraftKey]);
  useEffect(() => { void load(); }, [load]);
  const updateList = (id, update) => {
    setLists((current) => {
      const next = current.map((item) => item.id === id ? update(item) : item);
      localStorage.setItem(wardrobeDraftKey, JSON.stringify(next));
      return next;
    });
    setDirtyVersion((version) => version + 1);
  };
  useEffect(() => {
    if (!dirtyVersion) return;
    const timer = window.setTimeout(() => {
      Promise.all(lists.map((list) => api(`/api/wardrobes/${list.id}`, { method: "PATCH", body: list })))
        .then(() => localStorage.removeItem(wardrobeDraftKey))
        .catch(() => {});
    }, 800);
    return () => window.clearTimeout(timer);
  }, [dirtyVersion, wardrobeDraftKey]);
  const save = async (list) => { await api(`/api/wardrobes/${list.id}`, { method: "PATCH", body: list }); success(); load(); };
  const uploadSectionImage = async (listId, sectionId, file) => {
    const fd = new FormData();
    fd.append("file", file);
    const item = await api("/api/uploads/image", { method: "POST", body: fd });
    updateList(listId, (list) => ({ ...list, sections: list.sections.map((section) => section.id === sectionId ? { ...section, imageUrl: item.url } : section) }));
    success();
  };
  const create = async () => {
    const title = prompt("穿搭名称");
    if (!title?.trim()) return;
    await api("/api/wardrobes", { method: "POST", body: { title } });
    success();
    load();
  };
  return <section><ProjectTitle title={project.name} onRename={onRename} onDelete={onDelete}><button title="新增穿搭" onClick={create}><Plus size={18} /></button></ProjectTitle>
    {!lists.length && <Empty text={emptyText} />}
    <div className="wardrobes">{lists.map((list) => <article className={`wardrobe ${expandedId === list.id ? "expanded" : ""}`} key={list.id}><button className="star wardrobe-star" title="收藏" onClick={async () => { await api(`/api/wardrobes/${list.id}/favorite`, { method: "PATCH" }); load(); }}>{list.isFavorite ? "★" : "☆"}</button><button type="button" className="wardrobe-summary" onClick={() => setExpandedId((current) => current === list.id ? null : list.id)}><span>{list.title || "未命名穿搭"}</span><small>{list.sections.filter((section) => section.text || section.imageUrl).length} / {list.sections.length} 个分区已填写</small>{expandedId === list.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>
      {expandedId === list.id && <><input value={list.title} aria-label="穿搭名称" onChange={(e) => updateList(list.id, (item) => ({ ...item, title: e.target.value }))} />
      {list.sections.map((s) => <div className="wardrobe-section" key={s.id}><strong>{labels[s.sectionType]}</strong><textarea value={s.text} onChange={(e) => updateList(list.id, (item) => ({ ...item, sections: item.sections.map((section) => section.id === s.id ? { ...section, text: e.target.value } : section) }))} /><div>{s.imageUrl && <img src={s.imageUrl} />}<label className="upload-line"><Image size={16} />上传图片<input type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && uploadSectionImage(list.id, s.id, e.target.files[0])} /></label></div></div>)}
      <button onClick={() => save(list)}>保存</button><button className="danger" onClick={async () => { if (confirmDelete()) { await api(`/api/wardrobes/${list.id}`, { method: "DELETE" }); success(); setExpandedId(null); load(); } }}>删除</button></>}
    </article>)}</div>
  </section>;
}

function Plans({ project, onRename, onDelete }) {
  const [tasks, setTasks] = useState([]);
  const planDraftKey = `nancy-plan-draft-${project.id}`;
  const [form, setForm] = useState(() => {
    try { return { title: "", startDate: today(), endDate: today(), color: "#CDB4DB", note: "", ...JSON.parse(localStorage.getItem(planDraftKey) || "{}") }; }
    catch { return { title: "", startDate: today(), endDate: today(), color: "#CDB4DB", note: "" }; }
  });
  const load = useCallback(async () => {
    try {
      const next = await api("/api/plans");
      setTasks(Array.isArray(next) ? next : []);
    } catch {
      setTasks([]);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { localStorage.setItem(planDraftKey, JSON.stringify(form)); }, [form, planDraftKey]);
  const add = async () => {
    const title = form.title.trim() || prompt("任务名称");
    if (!title?.trim()) return;
    await api("/api/plans", { method: "POST", body: { ...form, title } });
    success();
    const emptyForm = { title: "", startDate: today(), endDate: today(), color: "#CDB4DB", note: "" };
    setForm(emptyForm);
    localStorage.removeItem(planDraftKey);
    load();
  };
  const minDate = tasks[0]?.startDate || today();
  return <section className="feature"><ProjectTitle title={project.name} onRename={onRename} onDelete={onDelete} />
    <div className="plan-form"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="任务名称" /><input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /><input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /><input className="color-picker" type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} title="标签颜色" /><button onClick={add}><Plus size={18} /></button></div>
    {!tasks.length && <Empty text={emptyText} />}
    <div className="gantt">{tasks.map((t) => {
      const left = Math.max(0, (new Date(t.startDate) - new Date(minDate)) / 86400000) * 28;
      const width = (Math.max(1, (new Date(t.endDate) - new Date(t.startDate)) / 86400000 + 1)) * 28;
      return <div className="gantt-row" key={t.id}><span>{t.title}</span><button className="star plan-star" title="收藏" onClick={async () => { await api(`/api/plans/${t.id}/favorite`, { method: "PATCH" }); load(); }}>{t.isFavorite ? "★" : "☆"}</button><button className={t.isDone ? "done" : ""} onClick={async () => { await api(`/api/plans/${t.id}`, { method: "PATCH", body: { ...t, isDone: !t.isDone } }); success(); load(); }}>{t.isDone ? "已完成" : "未完成"}</button><button className="danger" onClick={async () => { if (confirmDelete()) { await api(`/api/plans/${t.id}`, { method: "DELETE" }); success(); load(); } }}>删除</button><div className="bar" style={{ marginLeft: left, width, background: t.color }}>{t.startDate} - {t.endDate}</div></div>;
    })}</div>
  </section>;
}

function DrawingBoard({ project, onRename, onDelete }) {
  const canvasRef = useRef(null);
  const [ctx, setCtx] = useState(null);
  const [color, setColor] = useState("#4A3F55");
  const [size, setSize] = useState(5);
  const [tool, setTool] = useState("pen");
  const [drawings, setDrawings] = useState([]);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const drawing = useRef(false);
  const drawingDraftKey = `nancy-drawing-draft-${project.id}`;
  const load = useCallback(async () => {
    try {
      const next = await api("/api/drawings");
      setDrawings(Array.isArray(next) ? next : []);
    } catch {
      setDrawings([]);
    }
  }, []);
  const snapshot = () => canvasRef.current?.toDataURL("image/png");
  const restore = (dataUrl) => {
    if (!dataUrl || !ctx) return;
    const img = new window.Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      ctx.drawImage(img, 0, 0, canvas.clientWidth, canvas.clientHeight);
    };
    img.src = dataUrl;
  };
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.clientWidth * devicePixelRatio;
    canvas.height = canvas.clientHeight * devicePixelRatio;
    const c = canvas.getContext("2d");
    c.scale(devicePixelRatio, devicePixelRatio);
    c.lineCap = "round";
    c.fillStyle = "#fff";
    c.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    const draft = localStorage.getItem(drawingDraftKey);
    if (draft) {
      const image = new window.Image();
      image.onload = () => c.drawImage(image, 0, 0, canvas.clientWidth, canvas.clientHeight);
      image.src = draft;
    }
    setCtx(c);
    setHistory([canvas.toDataURL("image/png")]);
    void load();
  }, [load, drawingDraftKey]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const preventSingleFingerScroll = (event) => {
      if (drawing.current && event.touches.length === 1) event.preventDefault();
    };
    canvas.addEventListener("touchmove", preventSingleFingerScroll, { passive: false });
    return () => canvas.removeEventListener("touchmove", preventSingleFingerScroll);
  }, []);
  const pos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const p = e.touches?.[0] || e;
    return { x: p.clientX - rect.left, y: p.clientY - rect.top };
  };
  const down = (e) => { if (!ctx || (e.touches && e.touches.length !== 1)) { drawing.current = false; return; } drawing.current = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
  const move = (e) => { if (e.touches && e.touches.length !== 1) { drawing.current = false; return; } if (!drawing.current || !ctx) return; const p = pos(e); ctx.strokeStyle = tool === "eraser" ? "#fff" : color; ctx.lineWidth = size; ctx.lineTo(p.x, p.y); ctx.stroke(); };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const image = snapshot();
    if (image) localStorage.setItem(drawingDraftKey, image);
    setHistory((h) => [...h.slice(-24), image]);
    setFuture([]);
  };
  const clear = () => {
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    const image = snapshot();
    if (image) localStorage.setItem(drawingDraftKey, image);
    setHistory((h) => [...h.slice(-24), image]);
    setFuture([]);
  };
  const undo = () => {
    if (history.length < 2) return;
    const current = history[history.length - 1];
    const prev = history[history.length - 2];
    setFuture((f) => [current, ...f]);
    setHistory((h) => h.slice(0, -1));
    restore(prev);
  };
  const redo = () => {
    if (!future.length) return;
    const [next, ...rest] = future;
    setHistory((h) => [...h, next]);
    setFuture(rest);
    restore(next);
  };
  const save = async () => { await api("/api/drawings", { method: "POST", body: { title: `画作 ${fmt(new Date())}`, imageData: canvasRef.current.toDataURL("image/png") } }); localStorage.removeItem(drawingDraftKey); success(); load(); };
  const downloadPng = (drawingItem) => {
    const link = document.createElement("a");
    link.href = drawingItem.imageUrl;
    link.download = `${drawingItem.title || "画作"}.png`;
    link.click();
  };
  return <section className="feature"><ProjectTitle title={project.name} onRename={onRename} onDelete={onDelete} />
    <div className="format-row"><button className={tool === "pen" ? "active" : ""} onClick={() => setTool("pen")}><Brush size={18} />画笔</button><button className={tool === "eraser" ? "active" : ""} onClick={() => setTool("eraser")}>橡皮</button><input className="color-picker" type="color" value={color} onChange={(e) => setColor(e.target.value)} title="画笔颜色" /><input type="range" min="1" max="28" value={size} onChange={(e) => setSize(Number(e.target.value))} /><button onClick={undo}>撤销</button><button onClick={redo}>重做</button><button onClick={clear}><RotateCcw size={18} />清空</button><button onClick={save}><Save size={18} />保存</button></div>
    <canvas className="draw-canvas" ref={canvasRef} onMouseDown={down} onMouseMove={move} onMouseUp={up} onMouseLeave={up} onTouchStart={down} onTouchMove={move} onTouchEnd={up} onTouchCancel={up} />
    {!drawings.length && <Empty text={emptyText} />}
    <div className="drawing-list">{drawings.map((d) => <article key={d.id}><button className="star" title="收藏" onClick={async () => { await api(`/api/drawings/${d.id}/favorite`, { method: "PATCH" }); load(); }}>{d.isFavorite ? "★" : "☆"}</button><img src={d.imageUrl} /><div className="actions"><button type="button" onClick={() => downloadPng(d)}><Download size={18} />保存 PNG</button><button className="danger" onClick={async () => { if (confirmDelete()) { await api(`/api/drawings/${d.id}`, { method: "DELETE" }); success(); load(); } }}>删除</button></div></article>)}</div>
  </section>;
}

function Accounts({ user, setUser }) {
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ username: "", password: "" });
  const [password, setPassword] = useState("");
  const load = () => api("/api/accounts").then(setAccounts);
  useEffect(load, []);
  return <section><div className="section-head"><h2>账号管理</h2></div>
    <p className="fixed-copy">当前账号：{user.username}</p>
    <div className="new-row"><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="新账号用户名" /><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="新账号密码" /><button onClick={async () => { await api("/api/accounts", { method: "POST", body: form }); success(); setForm({ username: "", password: "" }); load(); }}>新建</button></div>
    <div className="new-row"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="修改当前账号密码" /><button onClick={async () => { await api(`/api/accounts/${user.id}/password`, { method: "PATCH", body: { password } }); success(); setPassword(""); }}>修改密码</button></div>
    {!accounts.length && <Empty text={emptyText} />}
    <div className="cards">{accounts.map((a) => <article className="note-card" key={a.id}><h3>{a.username}</h3><small>创建：{fmt(a.createdAt)}</small><button onClick={async () => { const d = await api(`/api/accounts/${a.id}/switch`, { method: "POST" }); success(); setUser(d.user); }}>切换</button><button className="danger" onClick={async () => { if (confirmDelete()) { await api(`/api/accounts/${a.id}`, { method: "DELETE" }); success(); if (a.id === user.id) setUser(null); else load(); } }}>删除</button></article>)}</div>
    <button onClick={async () => { await api("/api/auth/logout", { method: "POST" }); setUser(null); }}><LogOut size={18} />退出登录</button>
  </section>;
}

function Empty({ text }) {
  return <div className="empty">{text}</div>;
}

createRoot(document.getElementById("root")).render(<AppBoundary><App /></AppBoundary>);
