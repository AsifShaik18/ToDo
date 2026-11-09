/* ============================================================
   DayOS — private, encrypted day planner
   Vanilla JS, no build step. All data is AES-GCM encrypted
   with a key derived from your password (PBKDF2) and stored
   only in this browser's localStorage.
   ============================================================ */
'use strict';

/* ---------------- Utilities ---------------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const pad = n => String(n).padStart(2, '0');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const fromMin = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const fmt12 = m => {
  const h = Math.floor(m / 60) % 24, mm = m % 60;
  const h12 = ((h + 11) % 12) + 1, ap = h >= 12 ? 'PM' : 'AM';
  return mm ? `${h12}:${pad(mm)} ${ap}` : `${h12} ${ap}`;
};
const fmtDur = m => m >= 60 ? (m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60}h`) : `${m}m`;
const fmtHrs = m => (m / 60).toFixed(m % 60 ? 1 : 0) + 'h';
const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const todayKey = () => dateKey(new Date());
const dow = d => (d.getDay() + 6) % 7; // 0 = Monday
const startOfWeek = d => { const x = new Date(d); x.setDate(x.getDate() - dow(x)); x.setHours(0, 0, 0, 0); return x; };
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtLong = d => d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
const fmtShort = d => `${MONTHS[d.getMonth()]} ${d.getDate()}`;
const pct = (a, b) => b ? Math.round((a / b) * 100) : 0;
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

const ICONS = {
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m9 16 2 2 4-4"/></svg>',
  routine: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  board: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/></svg>',
  timer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6M12 2v3"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12-7.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>',
  learn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  stats: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-6"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
  grip: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>',
};

/* ---------------- Vault (encryption) ---------------- */
const Vault = {
  KEY: 'dayos.vault.v1',
  key: null, salt: null,
  exists() { return !!localStorage.getItem(this.KEY); },
  b64(buf) { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); },
  unb64(s) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); },
  async derive(pw, salt) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  },
  async setPassword(pw) { this.salt = crypto.getRandomValues(new Uint8Array(16)); this.key = await this.derive(pw, this.salt); },
  async save(data) {
    if (!this.key) return;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.key, new TextEncoder().encode(JSON.stringify(data)));
    localStorage.setItem(this.KEY, JSON.stringify({ v: 1, salt: this.b64(this.salt), iv: this.b64(iv), ct: this.b64(ct), at: Date.now() }));
  },
  async open(pw) {
    const rec = JSON.parse(localStorage.getItem(this.KEY));
    const salt = this.unb64(rec.salt);
    const key = await this.derive(pw, salt);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: this.unb64(rec.iv) }, key, this.unb64(rec.ct));
    this.key = key; this.salt = salt;
    return JSON.parse(new TextDecoder().decode(pt));
  },
  async verify(pw) { try { await this.open(pw); return true; } catch { return false; } },
  lock() { this.key = null; this.salt = null; },
  wipe() { localStorage.removeItem(this.KEY); },
};

/* ---------------- Default data ---------------- */
const AREA_COLORS = ['blue', 'orange', 'aqua', 'yellow', 'magenta', 'green', 'violet', 'red'];
const QUADS = [
  { id: 'vital', name: 'Very Important', desc: 'Do first. High impact and time-sensitive.', color: 'var(--c-red)' },
  { id: 'later', name: 'Important, Later', desc: 'Matters a lot, but can be scheduled.', color: 'var(--c-orange)' },
  { id: 'quick', name: 'Quick Wins', desc: 'Small things. Batch them and clear the deck.', color: 'var(--c-aqua)' },
  { id: 'someday', name: 'Someday / Ideas', desc: 'Parked ideas and nice-to-haves.', color: 'var(--c-violet)' },
];
const LEARN_TYPES = ['course', 'paper', 'article', 'book', 'podcast', 'video'];

function defaultRoutine() {
  const all = [0, 1, 2, 3, 4, 5, 6];
  const wk = [0, 1, 2, 3, 4];
  return [
    { id: uid(), title: 'Park / Exercise', area: 'health', start: '06:30', end: '07:00', days: all, note: 'Brisk walk' },
    { id: uid(), title: 'Research paper / Course', area: 'learn', start: '07:30', end: '08:50', days: all, note: '' },
    { id: uid(), title: 'Badminton', area: 'health', start: '09:00', end: '10:30', days: all, note: '' },
    { id: uid(), title: 'Plan office work', area: 'office', start: '11:00', end: '12:00', days: wk, note: 'Decide the top 3 for today' },
    { id: uid(), title: 'Go to office', area: 'office', start: '13:00', end: '14:00', days: wk, note: 'Commute' },
    { id: uid(), title: 'Office work', area: 'office', start: '14:00', end: '18:00', days: wk, note: '' },
    { id: uid(), title: 'Research paper / Jira', area: 'learn', start: '19:30', end: '21:20', days: all, note: '' },
    { id: uid(), title: 'Syncs', area: 'sync', start: '21:30', end: '23:00', days: all, note: '' },
    { id: uid(), title: 'Substack / LinkedIn / Podcast', area: 'content', start: '23:00', end: '24:00', days: all, note: '' },
  ];
}

function defaultState() {
  const now = Date.now();
  return {
    v: 1,
    settings: { name: '', theme: 'dark', dayStart: 6, dayEnd: 24, autoLock: 15, focusMin: 45, breakMin: 5, autoBreak: true, notify: true },
    sessions: [], timer: null,
    areas: [
      { id: 'health', name: 'Health', color: 'aqua' },
      { id: 'learn', name: 'Learning', color: 'blue' },
      { id: 'code', name: 'Coding', color: 'violet' },
      { id: 'office', name: 'Office', color: 'orange' },
      { id: 'sync', name: 'Syncs', color: 'yellow' },
      { id: 'content', name: 'Content', color: 'magenta' },
      { id: 'personal', name: 'Personal', color: 'green' },
    ],
    routine: defaultRoutine(),
    activities: [
      { id: uid(), title: 'Brisk walk', area: 'health', dur: 30 },
      { id: uid(), title: 'Badminton', area: 'health', dur: 90 },
      { id: uid(), title: 'Read research paper', area: 'learn', dur: 60 },
      { id: uid(), title: 'Course session', area: 'learn', dur: 60 },
      { id: uid(), title: 'Read articles', area: 'learn', dur: 30 },
      { id: uid(), title: 'Code: LangGraph / Agents', area: 'code', dur: 60 },
      { id: uid(), title: 'Code: RAG', area: 'code', dur: 60 },
      { id: uid(), title: 'Code: HMTA', area: 'code', dur: 60 },
      { id: uid(), title: 'Code: RL', area: 'code', dur: 60 },
      { id: uid(), title: 'Plan office work', area: 'office', dur: 45 },
      { id: uid(), title: 'Commute', area: 'office', dur: 60 },
      { id: uid(), title: 'Office work', area: 'office', dur: 120 },
      { id: uid(), title: 'Jira / tickets', area: 'office', dur: 45 },
      { id: uid(), title: 'Sync / meeting', area: 'sync', dur: 60 },
      { id: uid(), title: 'Substack / LinkedIn', area: 'content', dur: 30 },
      { id: uid(), title: 'Podcast', area: 'content', dur: 30 },
      { id: uid(), title: 'Return home', area: 'personal', dur: 30 },
      { id: uid(), title: 'Meal / break', area: 'personal', dur: 30 },
    ],
    days: {},
    tasks: [
      { id: uid(), title: 'Pick this week\'s research paper and skim the abstract', q: 'vital', area: 'learn', done: false, createdAt: now, due: todayKey(), note: '' },
      { id: uid(), title: 'Write the top 3 office priorities for tomorrow', q: 'vital', area: 'office', done: false, createdAt: now, due: '', note: '' },
      { id: uid(), title: 'Build a small RAG eval harness', q: 'later', area: 'code', done: false, createdAt: now, due: '', note: 'Start with 20 golden questions.' },
      { id: uid(), title: 'Draft a Substack post outline', q: 'later', area: 'content', done: false, createdAt: now, due: '', note: '' },
      { id: uid(), title: 'Book the badminton court', q: 'quick', area: 'health', done: false, createdAt: now, due: '', note: '' },
      { id: uid(), title: 'Clean up Jira board', q: 'quick', area: 'office', done: false, createdAt: now, due: '', note: '' },
      { id: uid(), title: 'Explore an RL course (Sutton & Barto, Spinning Up)', q: 'someday', area: 'learn', done: false, createdAt: now, due: '', note: '' },
    ],
    learning: [
      { id: uid(), title: 'Attention Is All You Need', type: 'paper', area: 'learn', status: 'active', link: 'https://arxiv.org/abs/1706.03762', note: '', progress: 0, createdAt: now,
        items: [{ id: uid(), title: 'Read abstract + intro', done: true }, { id: uid(), title: 'Understand multi-head attention', done: false }, { id: uid(), title: 'Write 5-line summary', done: false }] },
      { id: uid(), title: 'RAG from scratch', type: 'course', area: 'code', status: 'planned', link: '', note: '', progress: 0, createdAt: now,
        items: [{ id: uid(), title: 'Chunking strategies', done: false }, { id: uid(), title: 'Hybrid retrieval', done: false }, { id: uid(), title: 'Evaluation', done: false }] },
    ],
  };
}

/* ---------------- State ---------------- */
let S = null;
const UI = { view: 'today', date: todayKey(), learnType: 'all', learnStatus: 'all', range: 'week', showDone: false, tables: {} };
const save = debounce(() => { if (S) Vault.save(S).catch(e => toast('Save failed: ' + e.message)); }, 300);
const saveNow = () => S && Vault.save(S);

const areaById = id => S.areas.find(a => a.id === id) || S.areas[0];
const areaColor = id => `var(--c-${areaById(id).color})`;
const areaName = id => areaById(id).name;

function routineBlocksFor(key) {
  const w = dow(parseKey(key));
  return S.routine.filter(r => (r.days || []).includes(w)).map(r => ({
    id: uid(), title: r.title, area: r.area, start: toMin(r.start), end: toMin(r.end), done: false, note: r.note || '', rid: r.id,
  }));
}
function getDay(key, create = true) {
  let d = S.days[key];
  if (!d && create) {
    d = { blocks: key >= todayKey() ? routineBlocksFor(key) : [], journal: '' };
    S.days[key] = d; save();
  }
  return d;
}

/* ---------------- Stats ---------------- */
function dayStats(key) {
  const d = S.days[key];
  if (!d || !d.blocks.length) return null;
  const s = { planned: 0, done: 0, count: d.blocks.length, doneCount: 0, areas: {} };
  for (const b of d.blocks) {
    const dur = b.end - b.start;
    s.planned += dur;
    const a = s.areas[b.area] || (s.areas[b.area] = { planned: 0, done: 0, count: 0, doneCount: 0 });
    a.planned += dur; a.count++;
    if (b.done) { s.done += dur; s.doneCount++; a.done += dur; a.doneCount++; }
  }
  s.rate = pct(s.doneCount, s.count);
  return s;
}
function aggStats(keys) {
  const s = { planned: 0, done: 0, count: 0, doneCount: 0, days: 0, areas: {} };
  for (const k of keys) {
    const d = dayStats(k); if (!d) continue;
    s.days++; s.planned += d.planned; s.done += d.done; s.count += d.count; s.doneCount += d.doneCount;
    for (const [a, v] of Object.entries(d.areas)) {
      const t = s.areas[a] || (s.areas[a] = { planned: 0, done: 0, count: 0, doneCount: 0 });
      t.planned += v.planned; t.done += v.done; t.count += v.count; t.doneCount += v.doneCount;
    }
  }
  s.rate = pct(s.doneCount, s.count);
  return s;
}
function tasksDoneIn(keys) {
  const set = new Set(keys);
  return S.tasks.filter(t => t.done && t.doneAt && set.has(dateKey(new Date(t.doneAt)))).length;
}
const taskOrder = t => t.order ?? t.createdAt;
function quadList(q, includeDone = true) {
  return S.tasks.filter(t => t.q === q && (includeDone || !t.done)).sort((a, b) => (a.done - b.done) || (taskOrder(a) - taskOrder(b)));
}
// Place task t at visible position `index` inside quadrant q and renumber that quadrant.
function moveTask(t, q, index) {
  const visible = quadList(q, UI.showDone).filter(x => x !== t);
  index = clamp(index, 0, visible.length); visible.splice(index, 0, t); t.q = q;
  const hidden = quadList(q).filter(x => x !== t && !visible.includes(x));
  [...visible, ...hidden].forEach((x, i) => x.order = i);
  save(); render();
}
function streak() {
  let n = 0, d = new Date();
  const t = dayStats(todayKey());
  if (!t || t.rate < 50) d = addDays(d, -1); // today not counted yet
  for (let i = 0; i < 400; i++) {
    const s = dayStats(dateKey(d));
    if (s && s.rate >= 50) { n++; d = addDays(d, -1); } else break;
  }
  return n;
}
const keysBetween = (a, b) => { const out = []; for (let d = new Date(a); d <= b; d = addDays(d, 1)) out.push(dateKey(d)); return out; };
const lastNDays = n => keysBetween(addDays(new Date(), -(n - 1)), new Date());
function weekKeys(offset = 0) { const s = addDays(startOfWeek(new Date()), offset * 7); return keysBetween(s, addDays(s, 6)); }
function monthKeys(offset = 0) { const n = new Date(); const s = new Date(n.getFullYear(), n.getMonth() + offset, 1); const e = new Date(n.getFullYear(), n.getMonth() + offset + 1, 0); return keysBetween(s, e); }
function rangeKeys() { return UI.range === 'day' ? [todayKey()] : UI.range === 'week' ? weekKeys() : monthKeys(); }
function periods() {
  if (UI.range === 'day') return lastNDays(14).map(k => ({ label: fmtShort(parseKey(k)), keys: [k], full: fmtLong(parseKey(k)) }));
  if (UI.range === 'week') return Array.from({ length: 12 }, (_, i) => { const ks = weekKeys(i - 11); return { label: fmtShort(parseKey(ks[0])), keys: ks, full: `Week of ${fmtShort(parseKey(ks[0]))}` }; });
  return Array.from({ length: 12 }, (_, i) => { const ks = monthKeys(i - 11); const d = parseKey(ks[0]); return { label: MONTHS[d.getMonth()], keys: ks, full: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` }; });
}

/* ---------------- Timer engine ---------------- */
const fmtClock = ms => { const t = Math.max(0, Math.ceil(ms / 1000)); const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60; return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`; };
const sessionDay = x => dateKey(new Date(x.end));
function sessionsIn(keys) { const set = new Set(keys); return (S.sessions || []).filter(x => set.has(sessionDay(x))); }
const focusMins = list => list.filter(x => x.mode === 'focus').reduce((n, x) => n + x.mins, 0);
const breakMins = list => list.filter(x => x.mode === 'break').reduce((n, x) => n + x.mins, 0);
function spentOn(kind, id, keys = null) {
  let list = (S.sessions || []).filter(x => x.kind === kind && x.refId === id && x.mode === 'focus');
  if (keys) { const set = new Set(keys); list = list.filter(x => set.has(sessionDay(x))); }
  let m = list.reduce((n, x) => n + x.mins, 0);
  const t = S.timer; if (t && t.kind === kind && t.id === id && t.mode === 'focus') m += Timer.elapsedMs(t) / 60000;
  return Math.round(m);
}
function refOf(kind, id) { return kind === 'task' ? S.tasks.find(x => x.id === id) : kind === 'learn' ? S.learning.find(x => x.id === id) : null; }
let tickTimer = null;
const Timer = {
  elapsedMs(t = S.timer) { return t ? t.elapsedBefore + (t.pausedAt ? 0 : Date.now() - t.startedAt) : 0; },
  remainingMs(t = S.timer) { return t ? t.minutes * 60000 - this.elapsedMs(t) : 0; },
  running() { return !!(S.timer && !S.timer.pausedAt); },
  start({ kind = 'free', id = null, title = 'Free focus', area = null, mode = 'focus', minutes } = {}) {
    if (S.timer) this.stop({ silent: true });
    minutes = minutes || (mode === 'focus' ? S.settings.focusMin : S.settings.breakMin);
    S.timer = { kind, id, title, area, mode, minutes, startedAt: Date.now(), beganAt: Date.now(), pausedAt: null, elapsedBefore: 0 };
    if (S.settings.notify && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
    save(); render(); startTick();
  },
  pause() { const t = S.timer; if (!t || t.pausedAt) return; t.elapsedBefore += Date.now() - t.startedAt; t.pausedAt = Date.now(); save(); render(); },
  resume() { const t = S.timer; if (!t || !t.pausedAt) return; t.startedAt = Date.now(); t.pausedAt = null; save(); render(); startTick(); },
  extend(min) { const t = S.timer; if (!t) return; t.minutes += min; save(); render(); },
  // Lost the thread? Put the clock back to the full length for the same task. Partial time is discarded, not logged.
  restart() {
    const t = S.timer; if (!t) return;
    const ref = refOf(t.kind, t.id);
    t.minutes = t.mode === 'focus' ? ((ref && ref.estimate) || S.settings.focusMin) : S.settings.breakMin;
    t.elapsedBefore = 0; t.startedAt = Date.now(); t.beganAt = Date.now(); t.pausedAt = null;
    save(); render(); startTick(); toast(`Restarted · ${fmtClock(t.minutes * 60000)}`);
  },
  // Stop the current timer and log what was actually spent.
  stop({ silent = false } = {}) {
    const t = S.timer; if (!t) return;
    const ms = Math.min(this.elapsedMs(t), t.minutes * 60000);
    if (ms >= 30000) S.sessions.push({ id: uid(), kind: t.kind, refId: t.id, title: t.title, area: t.area, mode: t.mode, start: t.beganAt, end: Date.now(), mins: Math.round(ms / 6000) / 10 });
    S.timer = null; document.title = 'DayOS';
    save(); if (!silent) render();
  },
  // Natural end of a block: log it, then queue the next phase.
  complete() {
    const t = S.timer; if (!t) return;
    const ref = { kind: t.kind, id: t.id, title: t.title, area: t.area };
    this.stop({ silent: true });
    beep();
    if (t.mode === 'focus') {
      notify(`Focus block done. Take a ${S.settings.breakMin}-minute break.`);
      S.timer = { ...ref, mode: 'break', minutes: S.settings.breakMin, startedAt: Date.now(), beganAt: Date.now(), pausedAt: S.settings.autoBreak ? null : Date.now(), elapsedBefore: 0 };
    } else {
      notify('Break over. Ready for the next focus block.');
      S.timer = { ...ref, mode: 'focus', minutes: S.settings.focusMin, startedAt: Date.now(), beganAt: Date.now(), pausedAt: Date.now(), elapsedBefore: 0 };
    }
    save(); render();
  },
  skip() { const t = S.timer; if (!t) return; t.minutes = Math.max(0.5, this.elapsedMs(t) / 60000); this.complete(); },
  tick() { const t = S.timer; if (!t) { clearInterval(tickTimer); tickTimer = null; return; } if (!t.pausedAt && this.remainingMs(t) <= 0) { this.complete(); return; } updateTimerDisplays(); },
};
function startTick() { if (!tickTimer) tickTimer = setInterval(() => Timer.tick(), 1000); }
function updateTimerDisplays() {
  const t = S.timer; const txt = t ? fmtClock(Timer.remainingMs(t)) : '';
  $$('[data-timer-display]').forEach(el => { el.textContent = txt || el.dataset.idle || ''; });
  const ring = $('#ringFg'); if (ring && t) ring.style.strokeDashoffset = RING_C * (1 - clamp(Timer.elapsedMs(t) / (t.minutes * 60000), 0, 1));
  $$('[data-timer-spent]').forEach(el => { const [k, id] = el.dataset.timerSpent.split(':'); el.textContent = fmtDur(spentOn(k, id)); });
  document.title = t && !t.pausedAt ? `${txt} · ${t.mode === 'focus' ? 'Focus' : 'Break'} · DayOS` : 'DayOS';
}
const RING_C = 2 * Math.PI * 100;
function beep() {
  try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); [0, 0.22].forEach(d => { const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value = 880; g.gain.setValueAtTime(0.0001, ctx.currentTime + d); g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + d + 0.18); o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.2); }); } catch {}
}
function notify(msg) { toast(msg); try { if (S.settings.notify && 'Notification' in window && Notification.permission === 'granted') new Notification('DayOS', { body: msg }); } catch {} }
function timerButton(kind, ref, extraClass = '') {
  const t = S.timer; const mine = t && t.kind === kind && t.id === ref.id;
  if (mine && !t.pausedAt) return `<button class="btn sm tbtn on ${extraClass}" data-timer="${kind}:${ref.id}" title="Pause timer">${ICONS.pause} <span data-timer-display>${fmtClock(Timer.remainingMs(t))}</span></button>`;
  if (mine) return `<button class="btn sm tbtn paused ${extraClass}" data-timer="${kind}:${ref.id}" title="Resume timer">${ICONS.play} <span data-timer-display>${fmtClock(Timer.remainingMs(t))}</span></button>`;
  return `<button class="btn sm tbtn ${extraClass}" data-timer="${kind}:${ref.id}" title="Start a ${ref.estimate || S.settings.focusMin}-minute focus timer">${ICONS.play} ${ref.estimate || S.settings.focusMin}m</button>`;
}
function bindTimerButtons(scope) {
  $$('[data-timer]', scope).forEach(b => b.onclick = e => {
    e.stopPropagation(); e.preventDefault();
    const [kind, id] = b.dataset.timer.split(':'); const ref = refOf(kind, id); if (!ref) return;
    const t = S.timer;
    if (t && t.kind === kind && t.id === id) { t.pausedAt ? Timer.resume() : Timer.pause(); return; }
    Timer.start({ kind, id, title: ref.title, area: ref.area, mode: 'focus', minutes: ref.estimate || S.settings.focusMin });
    toast(`Focus timer started · ${ref.title}`);
  });
}

/* ---------------- Toast / tooltip ---------------- */
function toast(msg) {
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
  $('#toasts').appendChild(el); setTimeout(() => el.remove(), 2600);
}
const tip = $('#tooltip');
function showTip(e, html) { tip.innerHTML = html; tip.classList.add('show'); moveTip(e); }
function moveTip(e) { const x = Math.min(e.clientX, window.innerWidth - 220); tip.style.left = x + 'px'; tip.style.top = e.clientY + 'px'; }
function hideTip() { tip.classList.remove('show'); }

/* ---------------- Modal builder ---------------- */
function timeOptions(sel, from, to) {
  const opts = []; const step = 15;
  const vals = new Set();
  for (let m = Math.ceil(from / step) * step; m <= to; m += step) vals.add(m);
  if (sel != null) vals.add(sel);
  for (const m of [...vals].sort((a, b) => a - b)) opts.push(`<option value="${m}" ${m === sel ? 'selected' : ''}>${fmt12(m)}${m === 1440 ? ' (midnight)' : ''}</option>`);
  return opts.join('');
}
function openModal({ title, fields, values = {}, onSave, onDelete, saveLabel = 'Save' }) {
  const bg = document.createElement('div'); bg.className = 'modal-bg';
  const state = { ...values };
  const fieldHtml = f => {
    const v = state[f.k];
    const id = 'f_' + f.k;
    let input = '';
    switch (f.type) {
      case 'textarea': input = `<textarea class="input" id="${id}" placeholder="${esc(f.placeholder || '')}">${esc(v || '')}</textarea>`; break;
      case 'select': input = `<select class="input" id="${id}">${f.options.map(o => `<option value="${esc(o.v)}" ${o.v === v ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`; break;
      case 'area': input = `<select class="input" id="${id}">${S.areas.map(a => `<option value="${a.id}" ${a.id === v ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select>`; break;
      case 'time': input = `<select class="input" id="${id}">${timeOptions(v, f.min ?? 0, f.max ?? 1440)}</select>`; break;
      case 'date': input = `<input class="input" type="date" id="${id}" value="${esc(v || '')}">`; break;
      case 'number': input = `<input class="input" type="number" id="${id}" value="${esc(v ?? '')}" min="${f.min ?? ''}" max="${f.max ?? ''}" step="${f.step ?? 1}">`; break;
      case 'range': input = `<div style="display:flex;gap:10px;align-items:center"><input type="range" id="${id}" min="0" max="100" step="5" value="${v || 0}" style="flex:1"><b id="${id}_v" style="width:40px;text-align:right">${v || 0}%</b></div>`; break;
      case 'checkbox': return `<label class="check"><input type="checkbox" id="${id}" ${v ? 'checked' : ''}> ${esc(f.label)}</label>`;
      case 'days': input = `<div class="day-toggle" id="${id}">${DAYS.map((d, i) => `<button type="button" data-i="${i}" class="${(v || []).includes(i) ? 'on' : ''}">${d}</button>`).join('')}</div>`; break;
      case 'checklist': input = `<div class="checklist" id="${id}"></div><button type="button" class="btn sm" id="${id}_add">${ICONS.plus} Add item</button>`; break;
      default: input = `<input class="input" type="${f.type || 'text'}" id="${id}" value="${esc(v || '')}" placeholder="${esc(f.placeholder || '')}" ${f.autofocus ? 'autofocus' : ''}>`;
    }
    return `<div class="field"><label for="${id}">${esc(f.label)}</label>${input}${f.help ? `<span class="small muted">${f.help}</span>` : ''}</div>`;
  };
  // group half-width fields
  let body = ''; let i = 0;
  while (i < fields.length) {
    const f = fields[i];
    if (f.half && fields[i + 1] && fields[i + 1].half) { body += `<div class="field-row">${fieldHtml(f)}${fieldHtml(fields[i + 1])}</div>`; i += 2; }
    else { body += fieldHtml(f); i++; }
  }
  bg.innerHTML = `<form class="modal">
    <div class="modal-head"><h2>${esc(title)}</h2><button type="button" class="btn ghost icon" data-close>✕</button></div>
    <div class="modal-body">${body}</div>
    <div class="modal-foot">
      <div>${onDelete ? '<button type="button" class="btn danger" data-del>Delete</button>' : ''}</div>
      <div class="right"><button type="button" class="btn" data-close>Cancel</button><button type="submit" class="btn primary">${esc(saveLabel)}</button></div>
    </div></form>`;
  document.body.appendChild(bg);
  const close = () => { bg.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  bg.addEventListener('click', e => { if (e.target === bg) close(); });
  $$('[data-close]', bg).forEach(b => b.onclick = close);
  if (onDelete) $('[data-del]', bg).onclick = () => { close(); onDelete(); };
  // special fields
  for (const f of fields) {
    const el = $('#f_' + f.k, bg); if (!el) continue;
    if (f.type === 'days') el.onclick = e => { const b = e.target.closest('button'); if (b) b.classList.toggle('on'); };
    if (f.type === 'range') el.oninput = () => $('#f_' + f.k + '_v', bg).textContent = el.value + '%';
    if (f.type === 'checklist') {
      const items = (state[f.k] || []).map(x => ({ ...x }));
      const draw = () => {
        el.innerHTML = items.map((it, idx) => `<div class="ci"><input type="checkbox" data-i="${idx}" ${it.done ? 'checked' : ''}><input type="text" class="input" data-t="${idx}" value="${esc(it.title)}" placeholder="Item"><button type="button" class="btn ghost icon sm" data-x="${idx}">✕</button></div>`).join('') || '<span class="small muted">No checklist items yet.</span>';
      };
      draw();
      el.addEventListener('change', e => { const i = e.target.dataset.i; if (i != null) items[i].done = e.target.checked; });
      el.addEventListener('input', e => { const i = e.target.dataset.t; if (i != null) items[i].title = e.target.value; });
      el.addEventListener('click', e => { const b = e.target.closest('[data-x]'); if (b) { items.splice(+b.dataset.x, 1); draw(); } });
      $('#f_' + f.k + '_add', bg).onclick = () => { items.push({ id: uid(), title: '', done: false }); draw(); $$('input[type=text]', el).pop()?.focus(); };
      state['__cl_' + f.k] = items;
    }
    if (f.type === 'time' && f.linkEnd) {
      el.addEventListener('change', () => {
        const endEl = $('#f_' + f.linkEnd, bg); const st = +el.value; const en = +endEl.value;
        if (en <= st) {
          const want = st + (f.defaultDur || 60);
          const opts = [...endEl.options].map(o => +o.value);
          const pick = opts.find(x => x >= want) ?? opts.find(x => x > st) ?? opts[opts.length - 1];
          endEl.value = String(pick);
        }
      });
    }
  }
  const first = $('input, select, textarea', bg); if (first) setTimeout(() => first.focus(), 30);
  $('form', bg).onsubmit = e => {
    e.preventDefault();
    const out = {};
    for (const f of fields) {
      const el = $('#f_' + f.k, bg);
      if (f.type === 'checkbox') out[f.k] = el.checked;
      else if (f.type === 'days') out[f.k] = $$('button.on', el).map(b => +b.dataset.i);
      else if (f.type === 'checklist') out[f.k] = state['__cl_' + f.k].filter(x => x.title.trim());
      else if (f.type === 'time' || f.type === 'number' || f.type === 'range') out[f.k] = +el.value;
      else out[f.k] = el.value.trim();
    }
    if (fields.some(f => f.required && !out[f.k])) { toast('Please fill the required fields'); return; }
    close(); onSave(out);
  };
}
function confirmModal(title, text, { word, label = 'Confirm', danger = true } = {}) {
  return new Promise(res => {
    const fields = [];
    if (word) fields.push({ k: 'w', label: `Type ${word} to confirm`, placeholder: word, required: true });
    openModal({
      title, fields: [{ k: '_', label: '', type: 'static' }, ...fields].filter(f => f.type !== 'static'),
      saveLabel: label,
      onSave: v => { if (word && v.w !== word) { toast('Confirmation did not match'); res(false); } else res(true); },
    });
    const body = $('.modal-body'); body.insertAdjacentHTML('afterbegin', `<p class="muted" style="line-height:1.5">${text}</p>`);
    if (danger) $('.modal-foot .primary').classList.add('danger');
    // Cancel resolves false
    const bg = $('.modal-bg'); const obs = new MutationObserver(() => { if (!document.body.contains(bg)) { res(false); obs.disconnect(); } });
    obs.observe(document.body, { childList: true });
  });
}

/* ---------------- Rendering: shell ---------------- */
const VIEWS = [
  { id: 'today', name: 'Today', sub: 'Plan & track the day', icon: 'today', badge: () => { const s = dayStats(todayKey()); return s ? `${s.doneCount}/${s.count}` : ''; } },
  { id: 'routine', name: 'My Routine', sub: 'Daily schedule template', icon: 'routine', badge: () => `${S.routine.length}` },
  { id: 'board', name: 'Focus Board', sub: 'Priorities in 4 blocks', icon: 'board', badge: () => { const n = S.tasks.filter(t => !t.done && t.q === 'vital').length; return n ? `${n} vital` : ''; } },
  { id: 'timer', name: 'Timer', sub: 'Focus & break cycles', icon: 'timer', badge: () => S.timer ? `<span data-timer-display>${fmtClock(Timer.remainingMs())}</span>` : '' },
  { id: 'learn', name: 'Learning', sub: 'Courses, papers, articles', icon: 'learn', badge: () => { const n = S.learning.filter(l => l.status === 'active').length; return n ? `${n} active` : ''; } },
  { id: 'stats', name: 'Analytics', sub: 'Day · week · month', icon: 'stats', badge: () => '' },
  { id: 'settings', name: 'Settings', sub: 'Security, areas, data', icon: 'settings', badge: () => '' },
];
function renderNav() {
  $('#nav').innerHTML = VIEWS.map(v => `<button class="nav-item ${UI.view === v.id ? 'active' : ''}" data-view="${v.id}">
    <span class="ic">${ICONS[v.icon]}</span><span><span class="nm">${v.name}</span><span class="sub">${v.sub}</span></span><span class="badge" ${v.badge() ? '' : 'hidden'}>${v.badge()}</span></button>`).join('');
  $$('#nav .nav-item').forEach(b => b.onclick = () => { UI.view = b.dataset.view; render(); });
  $('#brandDate').textContent = fmtLong(new Date());
  const s = dayStats(todayKey()); const t = S.timer;
  if (t) {
    $('#sideStat').innerHTML = `<div class="lbl">${t.mode === 'focus' ? '● Focus' : '○ Break'}${t.pausedAt ? ' · paused' : ''}</div><div class="val" data-timer-display>${fmtClock(Timer.remainingMs(t))}</div>
      <div class="small muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.title)}</div>
      <div class="side-foot" style="margin-top:10px"><button class="btn sm" id="sideToggle">${t.pausedAt ? 'Start' : 'Pause'}</button><button class="btn sm" id="sideRestart" title="Restart from the full length">↺</button><button class="btn sm" id="sideStop">Stop</button></div>`;
    $('#sideToggle').onclick = () => t.pausedAt ? Timer.resume() : Timer.pause();
    $('#sideRestart').onclick = () => Timer.restart();
    $('#sideStop').onclick = () => { Timer.stop(); toast('Session logged'); };
  } else {
    const f = focusMins(sessionsIn([todayKey()]));
    $('#sideStat').innerHTML = `<div class="lbl">Today</div><div class="val">${s ? s.rate + '%' : '—'}</div>
      <div class="small muted">${s ? `${s.doneCount} of ${s.count} blocks · ${fmtHrs(s.done)} / ${fmtHrs(s.planned)}` : 'Nothing planned yet'}</div>
      <div class="meter"><i style="width:${s ? s.rate : 0}%"></i></div>
      <div class="small muted" style="margin-top:8px">🔥 ${streak()} day streak · ⏱ ${fmtDur(Math.round(f))} focus</div>`;
  }
}
function render() {
  if (!S) return;
  document.documentElement.dataset.theme = S.settings.theme;
  const changed = UI.prevView !== UI.view || UI.prevDate !== UI.date;
  UI.prevView = UI.view; UI.prevDate = UI.date; UI.scrollToNow = changed;
  renderNav();
  const v = $('#view');
  ({ today: renderToday, routine: renderRoutine, board: renderBoard, timer: renderTimer, learn: renderLearn, stats: renderStats, settings: renderSettings })[UI.view](v);
  bindTimerButtons(v);
  if (changed) $('.main').scrollTop = 0;
}

/* ---------------- Today view ---------------- */
const PPM = 1.45; // pixels per minute
let nowTimer = null;
function renderToday(v) {
  const key = UI.date, date = parseKey(key), isToday = key === todayKey();
  const day = getDay(key);
  const s = dayStats(key);
  const dayStart = S.settings.dayStart * 60, dayEnd = S.settings.dayEnd * 60;
  const vital = S.tasks.filter(t => !t.done && (t.q === 'vital' || t.due === key)).sort((a, b) => (a.q === 'vital' ? 0 : 1) - (b.q === 'vital' ? 0 : 1) || taskOrder(a) - taskOrder(b)).slice(0, 8);
  v.innerHTML = `
    <div class="view-head">
      <div><h1>${isToday ? 'Today' : key < todayKey() ? 'Looking back' : 'Planning ahead'}</h1><p class="sub">${fmtLong(date)}${S.settings.name ? ` · ${esc(S.settings.name)}` : ''}</p></div>
      <div class="actions">
        <div class="datebar"><button class="btn icon" id="prevDay">${ICONS.left}</button><span class="date">${fmtLong(date)}</span><button class="btn icon" id="nextDay">${ICONS.right}</button>${isToday ? '' : '<button class="btn sm" id="goToday">Today</button>'}</div>
        <button class="btn" id="applyRoutine">Apply routine</button>
        <button class="btn primary" id="addBlock">${ICONS.plus} Block</button>
      </div>
    </div>
    <div class="today-grid">
      <div>
        <div class="timeline-wrap"><div class="timeline" id="timeline" style="height:${(dayEnd - dayStart) * PPM}px"></div></div>
        <p class="small muted" style="margin-top:8px">Drag a block to move it, drag its bottom edge to resize, click to edit, double-click empty space to add. Drag activities from the right panel onto the timeline.</p>
      </div>
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="card">
          <div class="card-head"><h3>Day summary</h3><span class="chip">${s ? s.rate + '%' : '0%'}</span></div>
          ${s ? `<div class="progress"><i style="width:${s.rate}%"></i></div>
            <div class="small muted" style="margin-top:8px">${s.doneCount} of ${s.count} blocks done · ${fmtHrs(s.done)} of ${fmtHrs(s.planned)} planned</div>
            <div class="area-breakdown" style="margin-top:12px">${Object.entries(s.areas).sort((a, b) => b[1].planned - a[1].planned).map(([a, x]) => `
              <div class="ab-row"><span class="n"><span class="chip"><span class="dot" style="--c:${areaColor(a)}"></span>${esc(areaName(a))}</span></span><div class="progress"><i style="width:${pct(x.done, x.planned)}%;--c:${areaColor(a)}"></i></div><span class="v">${fmtHrs(x.done)}/${fmtHrs(x.planned)}</span></div>`).join('')}</div>`
          : '<div class="empty">No blocks yet. Apply your routine or drag activities in.</div>'}
        </div>
        <div class="card">
          <div class="card-head"><h3>Focus today</h3><button class="btn ghost sm" id="goBoard">Board →</button></div>
          <div class="focus-list">${vital.length ? vital.map(t => `<div class="focus-item ${t.done ? 'done' : ''}" draggable="true" data-task="${t.id}"><input type="checkbox" data-ft="${t.id}"><span class="t">${esc(t.title)}</span><span class="chip"><span class="dot" style="--c:${areaColor(t.area)}"></span>${esc(areaName(t.area))}</span></div>`).join('') : '<div class="empty">No vital tasks open. Nice.</div>'}</div>
          <p class="small muted" style="margin-top:8px">Tip: drag a task onto the timeline to schedule it.</p>
        </div>
        <div class="card">
          <div class="card-head"><h3>Activity blocks</h3><button class="btn ghost sm" id="addAct">${ICONS.plus} New</button></div>
          <div class="palette">${S.activities.map(a => `<div class="pal-item" draggable="true" data-act="${a.id}" style="--c:${areaColor(a.area)}"><span class="dot"></span><span><span class="n">${esc(a.title)}</span><br><span class="d">${esc(areaName(a.area))} · ${fmtDur(a.dur)}</span></span><button class="btn ghost icon sm add" data-quick="${a.id}" title="Add at next free slot">${ICONS.plus}</button></div>`).join('')}</div>
        </div>
        <div class="card journal">
          <div class="card-head"><h3>Notes for the day</h3></div>
          <textarea class="input" id="journal" placeholder="Wins, blockers, what to carry to tomorrow…">${esc(day.journal || '')}</textarea>
        </div>
      </div>
    </div>`;

  $('#prevDay').onclick = () => { UI.date = dateKey(addDays(date, -1)); render(); };
  $('#nextDay').onclick = () => { UI.date = dateKey(addDays(date, 1)); render(); };
  $('#goToday')?.addEventListener('click', () => { UI.date = todayKey(); render(); });
  $('#goBoard').onclick = () => { UI.view = 'board'; render(); };
  $('#addBlock').onclick = () => editBlock(key, null, { start: nextFreeSlot(day, 60), dur: 60 });
  $('#applyRoutine').onclick = async () => {
    const fresh = routineBlocksFor(key);
    if (!fresh.length) return toast('Your routine has no blocks for this weekday');
    if (day.blocks.length && !(await confirmModal('Apply routine', 'Add routine blocks that are not already on this day? Existing blocks are kept.', { label: 'Apply', danger: false }))) return;
    const have = new Set(day.blocks.map(b => b.rid).filter(Boolean));
    const add = fresh.filter(b => !have.has(b.rid));
    day.blocks.push(...add); save(); render(); toast(`${add.length} block${add.length === 1 ? '' : 's'} added`);
  };
  $('#addAct').onclick = () => openModal({
    title: 'New activity block', fields: [{ k: 'title', label: 'Title', required: true, autofocus: true }, { k: 'area', label: 'Area', type: 'area', half: true }, { k: 'dur', label: 'Duration (minutes)', type: 'number', min: 5, step: 5, half: true }],
    values: { area: S.areas[0].id, dur: 60 }, onSave: v => { S.activities.push({ id: uid(), ...v }); save(); render(); },
  });
  $('#journal').addEventListener('input', e => { day.journal = e.target.value; save(); });
  $$('[data-ft]', v).forEach(c => c.onchange = () => { const t = S.tasks.find(t => t.id === c.dataset.ft); t.done = true; t.doneAt = Date.now(); save(); render(); toast('Task done ✓'); });
  $$('[data-quick]', v).forEach(b => b.onclick = e => { e.stopPropagation(); const a = S.activities.find(x => x.id === b.dataset.quick); addBlock(key, { title: a.title, area: a.area, start: nextFreeSlot(day, a.dur), dur: a.dur }); });
  $$('.pal-item', v).forEach(p => {
    p.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', 'act:' + p.dataset.act); e.dataTransfer.effectAllowed = 'copy'; });
    p.addEventListener('contextmenu', e => { e.preventDefault(); const a = S.activities.find(x => x.id === p.dataset.act); openModal({ title: 'Edit activity', fields: [{ k: 'title', label: 'Title', required: true }, { k: 'area', label: 'Area', type: 'area', half: true }, { k: 'dur', label: 'Duration (minutes)', type: 'number', min: 5, step: 5, half: true }], values: a, onSave: v => { Object.assign(a, v); save(); render(); }, onDelete: () => { S.activities = S.activities.filter(x => x !== a); save(); render(); } }); });
  });
  $$('.focus-item', v).forEach(p => p.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', 'task:' + p.dataset.task); }));

  renderTimeline(key);
}
function nextFreeSlot(day, dur) {
  const dayStart = S.settings.dayStart * 60, dayEnd = S.settings.dayEnd * 60;
  const now = new Date();
  let t = UI.date === todayKey() ? Math.max(dayStart, Math.ceil((now.getHours() * 60 + now.getMinutes()) / 15) * 15) : dayStart;
  const sorted = [...day.blocks].sort((a, b) => a.start - b.start);
  for (;;) {
    const hit = sorted.find(b => b.start < t + dur && b.end > t);
    if (!hit) break; t = hit.end;
    if (t + dur > dayEnd) return Math.max(dayStart, dayEnd - dur);
  }
  return Math.min(t, dayEnd - dur);
}
function addBlock(key, { title, area, start, dur, taskId }) {
  const day = getDay(key); const dayEnd = S.settings.dayEnd * 60;
  start = clamp(Math.round(start / 5) * 5, S.settings.dayStart * 60, dayEnd - 5);
  day.blocks.push({ id: uid(), title, area, start, end: Math.min(dayEnd, start + dur), done: false, note: '', taskId });
  save(); render();
}
function editBlock(key, block, defaults = {}) {
  const day = getDay(key); const dayStart = S.settings.dayStart * 60, dayEnd = S.settings.dayEnd * 60;
  const isNew = !block;
  const vals = block ? { ...block } : { title: '', area: S.areas[0].id, start: defaults.start ?? dayStart, end: Math.min(dayEnd, (defaults.start ?? dayStart) + (defaults.dur ?? 60)), done: false, note: '' };
  openModal({
    title: isNew ? 'New block' : 'Edit block',
    fields: [
      { k: 'title', label: 'What', required: true, autofocus: true, placeholder: 'e.g. Read research paper' },
      { k: 'area', label: 'Area', type: 'area' },
      { k: 'start', label: 'From', type: 'time', min: dayStart, max: dayEnd - 5, half: true, linkEnd: 'end', defaultDur: 60 },
      { k: 'end', label: 'To', type: 'time', min: dayStart + 5, max: dayEnd, half: true },
      { k: 'note', label: 'Notes', type: 'textarea', placeholder: 'Anything to remember, links, outcome…' },
      { k: 'done', label: 'Done', type: 'checkbox' },
    ],
    values: vals,
    onSave: v => {
      if (v.end <= v.start) v.end = Math.min(dayEnd, v.start + 30);
      if (isNew) day.blocks.push({ id: uid(), ...v }); else Object.assign(block, v);
      save(); render();
    },
    onDelete: isNew ? null : () => { day.blocks = day.blocks.filter(b => b !== block); save(); render(); },
  });
}
function layoutLanes(blocks) {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || a.end - b.end);
  const pos = {}; let cluster = [], clusterEnd = -1, lanes = [];
  const flush = () => { for (const b of cluster) pos[b.id].n = lanes.length; cluster = []; lanes = []; };
  for (const b of sorted) {
    if (cluster.length && b.start >= clusterEnd) flush();
    let li = lanes.findIndex(e => e <= b.start); if (li < 0) { li = lanes.length; lanes.push(0); }
    lanes[li] = b.end; pos[b.id] = { lane: li }; cluster.push(b); clusterEnd = Math.max(clusterEnd, b.end);
  }
  flush(); return pos;
}
function renderTimeline(key) {
  const tl = $('#timeline'); const day = getDay(key);
  const dayStart = S.settings.dayStart * 60, dayEnd = S.settings.dayEnd * 60;
  const y = m => (m - dayStart) * PPM;
  let html = '';
  for (let h = S.settings.dayStart; h <= S.settings.dayEnd; h++) {
    html += `<div class="tl-hour" style="top:${y(h * 60)}px"><span>${fmt12(h * 60)}</span></div>`;
    if (h < S.settings.dayEnd) html += `<div class="tl-half" style="top:${y(h * 60 + 30)}px"></div>`;
  }
  html += `<div class="tl-now" id="nowLine" hidden></div><div class="tl-blocks" id="tlBlocks"></div>`;
  tl.innerHTML = html;
  const wrap = $('#tlBlocks');
  const pos = layoutLanes(day.blocks);
  wrap.innerHTML = day.blocks.map(b => {
    const p = pos[b.id]; const dur = b.end - b.start;
    return `<div class="block ${b.done ? 'done' : ''} ${dur < 35 ? 'short' : ''}" data-id="${b.id}" style="--c:${areaColor(b.area)};top:${y(b.start)}px;height:${Math.max(18, dur * PPM - 2)}px;left:calc(${(100 / p.n) * p.lane}% + ${p.lane ? 3 : 0}px);width:calc(${100 / p.n}% - ${p.n > 1 ? 3 : 0}px)">
      <div class="row"><input type="checkbox" class="ck" ${b.done ? 'checked' : ''} title="Mark done"><span class="t">${esc(b.title)}</span><span class="tm">${fmt12(b.start)} – ${fmt12(b.end)}</span></div>
      ${b.note ? `<div class="nt">${esc(b.note)}</div>` : `<div class="nt muted">${esc(areaName(b.area))} · ${fmtDur(dur)}</div>`}
      <div class="rs"></div></div>`;
  }).join('');

  // now line
  clearInterval(nowTimer);
  const updateNow = () => {
    const el = $('#nowLine'); if (!el) return;
    if (key !== todayKey()) { el.hidden = true; return; }
    const n = new Date(); const m = n.getHours() * 60 + n.getMinutes();
    if (m < dayStart || m > dayEnd) { el.hidden = true; return; }
    el.hidden = false; el.style.top = y(m) + 'px';
  };
  updateNow(); nowTimer = setInterval(updateNow, 30000);
  if (key === todayKey() && UI.scrollToNow) { const el = $('#nowLine'); if (el && !el.hidden) setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'instant' }), 0); }

  // interactions
  $$('.block', wrap).forEach(el => {
    const b = day.blocks.find(x => x.id === el.dataset.id);
    $('.ck', el).addEventListener('change', e => { b.done = e.target.checked; save(); render(); });
    $('.ck', el).addEventListener('pointerdown', e => e.stopPropagation());
    let mode = null, startY = 0, orig = null, moved = false;
    const down = (e, m) => { if (e.button !== 0) return; mode = m; startY = e.clientY; orig = { s: b.start, e: b.end }; moved = false; el.setPointerCapture(e.pointerId); e.preventDefault(); };
    el.addEventListener('pointerdown', e => { if (e.target.classList.contains('rs')) down(e, 'resize'); else down(e, 'move'); });
    el.addEventListener('pointermove', e => {
      if (!mode) return; const dy = e.clientY - startY; if (Math.abs(dy) > 3) { moved = true; el.classList.add('dragging'); }
      if (!moved) return;
      const dm = Math.round(dy / PPM / 5) * 5;
      if (mode === 'move') { const dur = orig.e - orig.s; const s = clamp(orig.s + dm, dayStart, dayEnd - dur); el.style.top = y(s) + 'px'; $('.tm', el).textContent = `${fmt12(s)} – ${fmt12(s + dur)}`; el.dataset.s = s; }
      else { const en = clamp(orig.e + dm, orig.s + 10, dayEnd); el.style.height = Math.max(18, (en - orig.s) * PPM - 2) + 'px'; $('.tm', el).textContent = `${fmt12(orig.s)} – ${fmt12(en)}`; el.dataset.e = en; }
    });
    el.addEventListener('pointerup', e => {
      if (!mode) return; const m = mode; mode = null; el.classList.remove('dragging');
      if (!moved) { if (m === 'move') editBlock(key, b); return; }
      if (m === 'move' && el.dataset.s) { const dur = b.end - b.start; b.start = +el.dataset.s; b.end = b.start + dur; }
      if (m === 'resize' && el.dataset.e) b.end = +el.dataset.e;
      save(); render();
    });
    el.addEventListener('pointercancel', () => { mode = null; el.classList.remove('dragging'); render(); });
  });
  tl.addEventListener('dblclick', e => {
    if (e.target.closest('.block')) return;
    const m = dayStart + Math.round((e.clientY - tl.getBoundingClientRect().top) / PPM / 15) * 15;
    editBlock(key, null, { start: clamp(m, dayStart, dayEnd - 15), dur: 60 });
  });
  tl.addEventListener('dragover', e => { e.preventDefault(); tl.classList.add('drop-target'); });
  tl.addEventListener('dragleave', () => tl.classList.remove('drop-target'));
  tl.addEventListener('drop', e => {
    e.preventDefault(); tl.classList.remove('drop-target');
    const data = e.dataTransfer.getData('text/plain'); if (!data) return;
    const m = dayStart + Math.round((e.clientY - tl.getBoundingClientRect().top) / PPM / 5) * 5;
    const [kind, id] = data.split(':');
    if (kind === 'act') { const a = S.activities.find(x => x.id === id); if (a) addBlock(key, { title: a.title, area: a.area, start: m, dur: a.dur }); }
    if (kind === 'task') { const t = S.tasks.find(x => x.id === id); if (t) addBlock(key, { title: t.title, area: t.area, start: m, dur: 60, taskId: t.id }); }
  });
}

/* ---------------- Routine view ---------------- */
function renderRoutine(v) {
  const items = [...S.routine].sort((a, b) => toMin(a.start) - toMin(b.start));
  const total = items.reduce((n, r) => n + (toMin(r.end) - toMin(r.start)), 0);
  v.innerHTML = `
    <div class="view-head">
      <div><h1>My Routine</h1><p class="sub">Your default day. New days are created from this template automatically.</p></div>
      <div class="actions"><button class="btn" id="resetRoutine">Reset to my default</button><button class="btn" id="applyToday">Apply to today</button><button class="btn primary" id="addRoutine">${ICONS.plus} Routine block</button></div>
    </div>
    <div class="tiles">
      <div class="tile"><div class="lbl">Blocks</div><div class="val">${items.length}</div></div>
      <div class="tile"><div class="lbl">Planned per day</div><div class="val">${fmtHrs(total)}</div><div class="delta">on a full day</div></div>
      ${S.areas.map(a => { const m = items.filter(r => r.area === a.id).reduce((n, r) => n + toMin(r.end) - toMin(r.start), 0); return m ? `<div class="tile"><div class="lbl"><span class="chip"><span class="dot" style="--c:${areaColor(a.id)}"></span>${esc(a.name)}</span></div><div class="val">${fmtHrs(m)}</div></div>` : ''; }).join('')}
    </div>
    <div class="routine-list">${items.length ? items.map(r => `
      <div class="routine-item" data-id="${r.id}" style="--c:${areaColor(r.area)}">
        <span class="grip">${ICONS.grip}</span>
        <div class="tm">${fmt12(toMin(r.start))} – ${fmt12(toMin(r.end))}<small>${fmtDur(toMin(r.end) - toMin(r.start))}</small></div>
        <div><div class="t">${esc(r.title)}</div><div class="nt">${esc(r.note || areaName(r.area))}</div></div>
        <div class="days">${DAYS.map((d, i) => `<b class="${(r.days || []).includes(i) ? 'on' : ''}">${d[0]}</b>`).join('')}</div>
        <span class="chip"><span class="dot"></span>${esc(areaName(r.area))}</span>
      </div>`).join('') : '<div class="empty">No routine blocks. Add one or reset to the default schedule.</div>'}</div>`;
  const edit = r => openModal({
    title: r ? 'Edit routine block' : 'New routine block',
    fields: [
      { k: 'title', label: 'What', required: true, autofocus: true },
      { k: 'area', label: 'Area', type: 'area' },
      { k: 'start', label: 'From', type: 'time', min: S.settings.dayStart * 60, max: S.settings.dayEnd * 60 - 5, half: true, linkEnd: 'end' },
      { k: 'end', label: 'To', type: 'time', min: S.settings.dayStart * 60 + 5, max: S.settings.dayEnd * 60, half: true },
      { k: 'days', label: 'Days', type: 'days' },
      { k: 'note', label: 'Note', type: 'textarea' },
    ],
    values: r ? { ...r, start: toMin(r.start), end: toMin(r.end) } : { area: S.areas[0].id, start: 9 * 60, end: 10 * 60, days: [0, 1, 2, 3, 4, 5, 6] },
    onSave: x => {
      if (x.end <= x.start) x.end = x.start + 30;
      const rec = { title: x.title, area: x.area, start: fromMin(x.start), end: fromMin(x.end), days: x.days, note: x.note };
      if (r) Object.assign(r, rec); else S.routine.push({ id: uid(), ...rec });
      save(); render();
    },
    onDelete: r ? () => { S.routine = S.routine.filter(x => x !== r); save(); render(); } : null,
  });
  $('#addRoutine').onclick = () => edit(null);
  $$('.routine-item', v).forEach(el => el.onclick = () => edit(S.routine.find(r => r.id === el.dataset.id)));
  $('#applyToday').onclick = () => { UI.date = todayKey(); UI.view = 'today'; render(); setTimeout(() => $('#applyRoutine')?.click(), 50); };
  $('#resetRoutine').onclick = async () => { if (await confirmModal('Reset routine', 'Replace your routine with the default schedule (park, paper, badminton, office, syncs, content)?', { label: 'Reset' })) { S.routine = defaultRoutine(); save(); render(); } };
}

/* ---------------- Focus board ---------------- */
function renderBoard(v) {
  const open = S.tasks.filter(t => !t.done);
  const doneWeek = tasksDoneIn(weekKeys()), doneToday = tasksDoneIn([todayKey()]);
  const total = S.tasks.length, done = S.tasks.filter(t => t.done).length;
  const due = t => { if (!t.due) return ''; const cls = t.due < todayKey() ? 'over' : t.due === todayKey() ? 'today' : ''; return `<span class="due ${cls}">${t.due === todayKey() ? 'Due today' : t.due < todayKey() ? 'Overdue · ' + fmtShort(parseKey(t.due)) : 'Due ' + fmtShort(parseKey(t.due))}</span>`; };
  v.innerHTML = `
    <div class="view-head">
      <div><h1>Focus Board</h1><p class="sub">Four blocks. Drag tasks up, down or across blocks as priorities shift.</p></div>
      <div class="actions"><label class="check"><input type="checkbox" id="showDone" ${UI.showDone ? 'checked' : ''}> Show completed</label><button class="btn primary" id="addTask">${ICONS.plus} Task</button></div>
    </div>
    <div class="tiles">
      <div class="tile"><div class="lbl">Open</div><div class="val">${open.length}</div><div class="delta">${open.filter(t => t.q === 'vital').length} very important</div></div>
      <div class="tile"><div class="lbl">Done today</div><div class="val">${doneToday}</div></div>
      <div class="tile"><div class="lbl">Done this week</div><div class="val">${doneWeek}</div></div>
      <div class="tile"><div class="lbl">Overall</div><div class="val">${pct(done, total)}<small>%</small></div><div class="delta">${done} of ${total} tasks</div></div>
    </div>
    <div class="board">${QUADS.map(q => {
      const all = S.tasks.filter(t => t.q === q.id); const dn = all.filter(t => t.done).length;
      const list = quadList(q.id, UI.showDone);
      return `<div class="quad" data-q="${q.id}" style="--qc:${q.color}">
        <div class="quad-head"><h3>${q.name}</h3><span class="cnt">${dn}/${all.length}</span></div>
        <div class="desc">${q.desc}</div>
        <div class="progress"><i style="width:${pct(dn, all.length)}%"></i></div>
        <form class="quad-add"><input class="input" placeholder="Add a task and press Enter" data-add="${q.id}"></form>
        <div class="tasks">${list.map(t => `<div class="task ${t.done ? 'done' : ''}" draggable="true" data-id="${t.id}">
          <input type="checkbox" ${t.done ? 'checked' : ''}><div><div class="t">${esc(t.title)}</div>
          <div class="meta"><span class="chip"><span class="dot" style="--c:${areaColor(t.area)}"></span>${esc(areaName(t.area))}</span>${due(t)}<span class="chip time" title="Focus time spent / estimate">⏱ <span data-timer-spent="task:${t.id}">${fmtDur(spentOn('task', t.id))}</span> / ${fmtDur(t.estimate || S.settings.focusMin)}</span></div>${t.note ? `<div class="nt">${esc(t.note)}</div>` : ''}</div>
          <span class="side">${timerButton('task', t)}<span class="mv"><button class="btn ghost icon sm" data-mv="top" title="Move to top">&#8648;</button><button class="btn ghost icon sm" data-mv="up" title="Move up">&#8593;</button><button class="btn ghost icon sm" data-mv="down" title="Move down">&#8595;</button><button class="btn ghost icon sm" data-mv="bottom" title="Move to bottom">&#8650;</button></span></span></div>`).join('') || '<div class="empty small">Nothing here</div>'}</div>
      </div>`; }).join('')}</div>`;
  const edit = (t, q) => openModal({
    title: t ? 'Edit task' : 'New task',
    fields: [
      { k: 'title', label: 'Task', required: true, autofocus: true },
      { k: 'q', label: 'Block', type: 'select', options: QUADS.map(q => ({ v: q.id, l: q.name })), half: true },
      { k: 'area', label: 'Area', type: 'area', half: true },
      { k: 'due', label: 'Due date', type: 'date', half: true },
      { k: 'estimate', label: 'Focus timer length (minutes)', type: 'number', min: 5, step: 5, half: true },
      { k: 'note', label: 'Notes', type: 'textarea', placeholder: 'Context, links, sub-steps…' },
      { k: 'done', label: 'Done', type: 'checkbox' },
    ],
    values: t ? { ...t, estimate: t.estimate || S.settings.focusMin } : { q: q || 'vital', area: S.areas[0].id, due: '', note: '', done: false, estimate: S.settings.focusMin },
    onSave: x => {
      if (t) { if (x.done && !t.done) t.doneAt = Date.now(); if (!x.done) t.doneAt = null; Object.assign(t, x); }
      else S.tasks.push({ id: uid(), createdAt: Date.now(), doneAt: x.done ? Date.now() : null, order: Date.now(), ...x });
      save(); render();
    },
    onDelete: t ? () => { S.tasks = S.tasks.filter(x => x !== t); save(); render(); } : null,
  });
  $('#addTask').onclick = () => edit(null);
  $('#showDone').onchange = e => { UI.showDone = e.target.checked; render(); };
  $$('.quad-add', v).forEach(f => f.onsubmit = e => { e.preventDefault(); const inp = $('input', f); const title = inp.value.trim(); if (!title) return; S.tasks.push({ id: uid(), title, q: inp.dataset.add, area: S.areas[0].id, done: false, createdAt: Date.now(), order: Date.now(), due: '', note: '' }); save(); render(); setTimeout(() => $(`[data-add="${inp.dataset.add}"]`)?.focus(), 0); });
  $$('.task', v).forEach(el => {
    const t = S.tasks.find(x => x.id === el.dataset.id);
    $('input', el).onclick = e => { e.stopPropagation(); t.done = e.target.checked; t.doneAt = t.done ? Date.now() : null; save(); render(); };
    el.onclick = e => { if (e.target.closest('[data-mv], [data-timer]')) return; edit(t); };
    $$('[data-mv]', el).forEach(b => b.onclick = e => {
      e.stopPropagation();
      const list = quadList(t.q, UI.showDone); const i = list.indexOf(t);
      const to = { top: 0, up: i - 1, down: i + 1, bottom: list.length - 1 }[b.dataset.mv];
      if (to !== i) moveTask(t, t.q, to);
    });
    el.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', 'task:' + t.id); e.dataTransfer.effectAllowed = 'move'; el.classList.add('dragging'); });
    el.addEventListener('dragend', () => { el.classList.remove('dragging'); clearDrop(); });
    el.addEventListener('dragover', e => {
      e.preventDefault(); const r = el.getBoundingClientRect(); const before = e.clientY < r.top + r.height / 2;
      if (UI.drop?.id !== t.id || UI.drop.before !== before) { clearDrop(); UI.drop = { id: t.id, before }; el.classList.add(before ? 'drop-before' : 'drop-after'); }
    });
  });
  const clearDrop = () => { UI.drop = null; $$('.task.drop-before, .task.drop-after', v).forEach(x => x.classList.remove('drop-before', 'drop-after')); };
  $$('.quad', v).forEach(q => {
    q.addEventListener('dragover', e => { e.preventDefault(); q.classList.add('drag-over'); if (!e.target.closest('.task')) clearDrop(); });
    q.addEventListener('dragleave', e => { if (!q.contains(e.relatedTarget)) { q.classList.remove('drag-over'); clearDrop(); } });
    q.addEventListener('drop', e => {
      e.preventDefault(); q.classList.remove('drag-over');
      const d = e.dataTransfer.getData('text/plain'); if (!d.startsWith('task:')) return clearDrop();
      const t = S.tasks.find(x => x.id === d.slice(5)); if (!t) return clearDrop();
      const target = q.dataset.q; const list = quadList(target, UI.showDone).filter(x => x !== t);
      let index = list.length;
      if (UI.drop) { const i = list.findIndex(x => x.id === UI.drop.id); if (i >= 0) index = i + (UI.drop.before ? 0 : 1); }
      clearDrop(); moveTask(t, target, index);
    });
  });
}

/* ---------------- Timer view ---------------- */
function renderTimer(v) {
  const t = S.timer, st = S.settings;
  const todayS = sessionsIn([todayKey()]), weekS = sessionsIn(weekKeys());
  const fT = Math.round(focusMins(todayS)), bT = Math.round(breakMins(todayS));
  const openTasks = quadList('vital', false).concat(quadList('later', false), quadList('quick', false), quadList('someday', false));
  const activeLearn = S.learning.filter(l => l.status !== 'done');
  const sel = t ? `${t.kind}:${t.id}` : (UI.timerRef || '');
  const options = `<option value="">Free focus (no task)</option>
    <optgroup label="Focus board">${openTasks.map(x => `<option value="task:${x.id}" ${sel === 'task:' + x.id ? 'selected' : ''}>${esc(x.title)}</option>`).join('')}</optgroup>
    <optgroup label="Learning">${activeLearn.map(x => `<option value="learn:${x.id}" ${sel === 'learn:' + x.id ? 'selected' : ''}>${esc(x.title)}</option>`).join('')}</optgroup>`;
  const prog = t ? clamp(Timer.elapsedMs(t) / (t.minutes * 60000), 0, 1) : 0;
  const blocks = Math.floor(fT / st.focusMin);
  v.innerHTML = `
    <div class="view-head">
      <div><h1>Timer</h1><p class="sub">Work in ${st.focusMin}-minute focus blocks with a ${st.breakMin}-minute break after each. Every session is logged against its task.</p></div>
      <div class="actions">
        <div class="seg" title="Focus length">${[25, 45, 50, 90].map(m => `<button class="${st.focusMin === m ? 'on' : ''}" data-f="${m}">${m}m focus</button>`).join('')}</div>
        <div class="seg" title="Break length">${[5, 10, 15].map(m => `<button class="${st.breakMin === m ? 'on' : ''}" data-b="${m}">${m}m break</button>`).join('')}</div>
      </div>
    </div>
    <div class="timer-grid">
      <div class="card timer-card ${t ? t.mode : 'idle'} ${t && t.pausedAt ? 'paused' : ''}">
        <div class="ring"><svg viewBox="0 0 220 220"><circle class="bg" cx="110" cy="110" r="100"/><circle class="fg" id="ringFg" cx="110" cy="110" r="100" stroke-dasharray="${RING_C}" stroke-dashoffset="${RING_C * (1 - prog)}"/></svg>
          <div class="ring-inner"><div class="mode">${t ? (t.mode === 'focus' ? 'Focus' : 'Break') + (t.pausedAt ? ' · paused' : '') : 'Ready'}</div><div class="clock" data-timer-display data-idle="${fmtClock(st.focusMin * 60000)}">${t ? fmtClock(Timer.remainingMs(t)) : fmtClock(st.focusMin * 60000)}</div><div class="who">${t ? esc(t.title) : 'Pick something to work on'}</div></div></div>
        <div class="timer-controls">
          ${!t ? `<button class="btn primary" id="tStart">${ICONS.play} Start focus</button><button class="btn" id="tBreak">Start a break</button>`
            : t.pausedAt ? `<button class="btn primary" id="tResume">${ICONS.play} ${t.elapsedBefore ? 'Resume' : 'Start ' + t.mode}</button>` : `<button class="btn" id="tPause">${ICONS.pause} Pause</button>`}
          ${t ? `<button class="btn" id="tRestart" title="Back to the full length, discard this attempt">↺ Restart</button><button class="btn" id="tStop">■ Stop & log</button><button class="btn" id="tSkip">${t.mode === 'focus' ? 'Finish early → break' : 'Skip break'}</button><button class="btn ghost" id="tPlus">+5 min</button>` : ''}
        </div>
        <div class="field" style="margin-top:16px"><label>Working on</label><select class="input" id="tRef">${options}</select></div>
        <label class="check" style="margin-top:12px"><input type="checkbox" id="tAuto" ${st.autoBreak ? 'checked' : ''}> Start the ${st.breakMin}-minute break automatically when a focus block ends</label>
        <label class="check" style="margin-top:6px"><input type="checkbox" id="tNotify" ${st.notify ? 'checked' : ''}> Desktop notification and sound when a block ends</label>
      </div>
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="tiles" style="margin:0">
          <div class="tile"><div class="lbl">Focus today</div><div class="val">${fmtDur(fT)}</div><div class="delta">${blocks} full block${blocks === 1 ? '' : 's'} of ${st.focusMin}m</div></div>
          <div class="tile"><div class="lbl">Break today</div><div class="val">${fmtDur(bT)}</div><div class="delta ${fT >= st.focusMin && bT < Math.floor(fT / st.focusMin) * st.breakMin ? 'down' : ''}">${fT >= st.focusMin && bT < Math.floor(fT / st.focusMin) * st.breakMin ? 'Below the 1 break per block rule' : 'On track'}</div></div>
          <div class="tile"><div class="lbl">Sessions today</div><div class="val">${todayS.filter(x => x.mode === 'focus').length}</div></div>
          <div class="tile"><div class="lbl">Focus this week</div><div class="val">${fmtDur(Math.round(focusMins(weekS)))}</div><div class="delta">${fmtDur(Math.round(breakMins(weekS)))} of breaks</div></div>
        </div>
        <div class="card"><div class="card-head"><h3>Focus minutes per day · this week</h3></div><div id="chFocusWeek"></div></div>
        <div class="card">
          <div class="card-head"><h3>Today's sessions</h3><button class="btn ghost sm" id="logManual">${ICONS.plus} Log time</button></div>
          <div class="sess-list">${todayS.length ? [...todayS].reverse().map(x => `<div class="sess ${x.mode}" data-sid="${x.id}">
            <span class="chip"><span class="dot" style="--c:${x.mode === 'focus' ? (x.area ? areaColor(x.area) : 'var(--accent)') : 'var(--text-3)'}"></span>${x.mode}</span>
            <span class="t">${esc(x.title)}</span><span class="muted small">${new Date(x.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – ${new Date(x.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
            <b>${fmtDur(Math.round(x.mins))}</b><button class="btn ghost icon sm" data-del title="Remove">✕</button></div>`).join('') : '<div class="empty">No sessions yet today. Start a focus block.</div>'}</div>
        </div>
      </div>
    </div>`;
  const refFromSelect = () => { const val = $('#tRef').value; if (!val) return { kind: 'free', id: null, title: 'Free focus', area: null }; const [kind, id] = val.split(':'); const r = refOf(kind, id); return r ? { kind, id, title: r.title, area: r.area, minutes: r.estimate } : null; };
  $('#tRef').onchange = () => { UI.timerRef = $('#tRef').value; if (S.timer) { const r = refFromSelect(); if (r) { Object.assign(S.timer, { kind: r.kind, id: r.id, title: r.title, area: r.area }); save(); render(); } } };
  $('#tStart')?.addEventListener('click', () => { const r = refFromSelect(); Timer.start({ ...r, mode: 'focus', minutes: r.minutes || st.focusMin }); });
  $('#tBreak')?.addEventListener('click', () => { const r = refFromSelect(); Timer.start({ ...r, mode: 'break', minutes: st.breakMin }); });
  $('#tResume')?.addEventListener('click', () => Timer.resume());
  $('#tPause')?.addEventListener('click', () => Timer.pause());
  $('#tStop')?.addEventListener('click', () => { Timer.stop(); toast('Session logged'); });
  $('#tRestart')?.addEventListener('click', () => Timer.restart());
  $('#tSkip')?.addEventListener('click', () => Timer.skip());
  $('#tPlus')?.addEventListener('click', () => Timer.extend(5));
  $('#tAuto').onchange = e => { st.autoBreak = e.target.checked; save(); };
  $('#tNotify').onchange = e => { st.notify = e.target.checked; save(); if (st.notify && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {}); };
  $$('[data-f]', v).forEach(b => b.onclick = () => { st.focusMin = +b.dataset.f; save(); render(); });
  $$('[data-b]', v).forEach(b => b.onclick = () => { st.breakMin = +b.dataset.b; save(); render(); });
  $$('.sess [data-del]', v).forEach(b => b.onclick = () => { const id = b.closest('.sess').dataset.sid; S.sessions = S.sessions.filter(x => x.id !== id); save(); render(); });
  $('#logManual').onclick = () => openModal({
    title: 'Log time manually',
    fields: [
      { k: 'ref', label: 'Working on', type: 'select', options: [{ v: '', l: 'Free focus (no task)' }, ...openTasks.map(x => ({ v: 'task:' + x.id, l: x.title })), ...activeLearn.map(x => ({ v: 'learn:' + x.id, l: x.title }))] },
      { k: 'mins', label: 'Minutes', type: 'number', min: 1, step: 5, half: true },
      { k: 'mode', label: 'Type', type: 'select', options: [{ v: 'focus', l: 'Focus' }, { v: 'break', l: 'Break' }], half: true },
      { k: 'date', label: 'Date', type: 'date' },
    ],
    values: { ref: UI.timerRef || '', mins: st.focusMin, mode: 'focus', date: todayKey() },
    onSave: x => {
      if (!x.mins) return;
      let ref = { kind: 'free', id: null, title: 'Free focus', area: null };
      if (x.ref) { const [kind, id] = x.ref.split(':'); const r = refOf(kind, id); if (r) ref = { kind, id, title: r.title, area: r.area }; }
      const end = x.date ? parseKey(x.date).setHours(12, 0, 0, 0) : Date.now();
      S.sessions.push({ id: uid(), ...ref, refId: ref.id, mode: x.mode, start: end - x.mins * 60000, end, mins: x.mins, manual: true });
      save(); render(); toast('Time logged');
    },
  });
  const wk = weekKeys().map(k => ({ label: DAYS[dow(parseKey(k))], full: fmtLong(parseKey(k)), value: Math.round(focusMins(sessionsIn([k]))) }));
  vbarChart($('#chFocusWeek'), wk, { cols: ['Day', 'Focus min'], tip: p => `${fmtDur(p.value)} focus` });
  if (t) startTick();
}

/* ---------------- Learning ---------------- */
function learnProgress(l) { return l.items?.length ? pct(l.items.filter(i => i.done).length, l.items.length) : (l.progress || 0); }
function renderLearn(v) {
  let list = S.learning.filter(l => (UI.learnType === 'all' || l.type === UI.learnType) && (UI.learnStatus === 'all' || l.status === UI.learnStatus));
  list = list.sort((a, b) => ({ active: 0, planned: 1, done: 2 }[a.status] - { active: 0, planned: 1, done: 2 }[b.status]) || b.createdAt - a.createdAt);
  const counts = { active: S.learning.filter(l => l.status === 'active').length, done: S.learning.filter(l => l.status === 'done').length, planned: S.learning.filter(l => l.status === 'planned').length };
  v.innerHTML = `
    <div class="view-head">
      <div><h1>Learning</h1><p class="sub">Courses, research papers, articles, books. What you're building toward.</p></div>
      <div class="actions"><button class="btn primary" id="addLearn">${ICONS.plus} Add</button></div>
    </div>
    <div class="tiles">
      <div class="tile"><div class="lbl">In progress</div><div class="val">${counts.active}</div></div>
      <div class="tile"><div class="lbl">Planned</div><div class="val">${counts.planned}</div></div>
      <div class="tile"><div class="lbl">Completed</div><div class="val">${counts.done}</div></div>
      <div class="tile"><div class="lbl">Avg progress (active)</div><div class="val">${counts.active ? Math.round(S.learning.filter(l => l.status === 'active').reduce((n, l) => n + learnProgress(l), 0) / counts.active) : 0}<small>%</small></div></div>
    </div>
    <div class="card" style="margin-bottom:16px;display:flex;gap:16px;flex-wrap:wrap;align-items:center">
      <div class="filters">${['all', ...LEARN_TYPES].map(t => `<button class="btn sm ${UI.learnType === t ? 'on' : ''}" data-lt="${t}">${t[0].toUpperCase() + t.slice(1)}${t !== 'all' ? 's' : ''}</button>`).join('')}</div>
      <div class="seg">${['all', 'active', 'planned', 'done'].map(s => `<button class="${UI.learnStatus === s ? 'on' : ''}" data-ls="${s}">${s[0].toUpperCase() + s.slice(1)}</button>`).join('')}</div>
    </div>
    <div class="learn-grid">${list.length ? list.map(l => `<div class="lcard" data-id="${l.id}" style="--c:${areaColor(l.area)}">
      <div class="top"><span class="type">${esc(l.type)}</span><span style="display:flex;gap:6px;align-items:center">${l.status !== 'done' ? timerButton('learn', l) : ''}<span class="status ${l.status}">${l.status}</span></span></div>
      <h3>${esc(l.title)}</h3>
      <div class="top"><span style="display:flex;gap:6px;flex-wrap:wrap"><span class="chip"><span class="dot"></span>${esc(areaName(l.area))}</span><span class="chip time">⏱ <span data-timer-spent="learn:${l.id}">${fmtDur(spentOn('learn', l.id))}</span></span></span><span class="pct">${learnProgress(l)}%</span></div>
      <div class="progress"><i style="width:${learnProgress(l)}%"></i></div>
      ${l.items?.length ? `<div class="items">${l.items.map(i => `<label class="${i.done ? 'done' : ''}"><input type="checkbox" data-item="${i.id}" ${i.done ? 'checked' : ''}>${esc(i.title)}</label>`).join('')}</div>` : ''}
      ${l.note ? `<p class="small muted" style="white-space:pre-wrap">${esc(l.note)}</p>` : ''}
      ${l.link ? `<a class="small" href="${esc(l.link)}" target="_blank" rel="noopener" data-link>${ICONS.link.replace('<svg', '<svg style="width:12px;height:12px;vertical-align:-2px"')} Open link</a>` : ''}
    </div>`).join('') : '<div class="empty">Nothing matches. Add a course, paper or article.</div>'}</div>`;
  const edit = l => openModal({
    title: l ? 'Edit' : 'Add to learning',
    fields: [
      { k: 'title', label: 'Title', required: true, autofocus: true },
      { k: 'type', label: 'Type', type: 'select', options: LEARN_TYPES.map(t => ({ v: t, l: t[0].toUpperCase() + t.slice(1) })), half: true },
      { k: 'area', label: 'Area', type: 'area', half: true },
      { k: 'status', label: 'Status', type: 'select', options: [{ v: 'planned', l: 'Planned' }, { v: 'active', l: 'In progress' }, { v: 'done', l: 'Completed' }], half: true },
      { k: 'link', label: 'Link', type: 'url', placeholder: 'https://', half: true },
      { k: 'items', label: 'Checklist (progress is computed from it)', type: 'checklist' },
      { k: 'progress', label: 'Manual progress (used when there is no checklist)', type: 'range' },
      { k: 'note', label: 'Notes', type: 'textarea', placeholder: 'Key takeaways, where you left off…' },
    ],
    values: l || { type: 'paper', area: 'learn', status: 'planned', link: '', items: [], progress: 0, note: '' },
    onSave: x => { if (l) Object.assign(l, x); else S.learning.push({ id: uid(), createdAt: Date.now(), ...x }); save(); render(); },
    onDelete: l ? () => { S.learning = S.learning.filter(x => x !== l); save(); render(); } : null,
  });
  $('#addLearn').onclick = () => edit(null);
  $$('[data-lt]', v).forEach(b => b.onclick = () => { UI.learnType = b.dataset.lt; render(); });
  $$('[data-ls]', v).forEach(b => b.onclick = () => { UI.learnStatus = b.dataset.ls; render(); });
  $$('.lcard', v).forEach(el => {
    const l = S.learning.find(x => x.id === el.dataset.id);
    el.onclick = e => { if (e.target.closest('[data-item], label, [data-link], [data-timer]')) return; edit(l); };
    $$('[data-item]', el).forEach(c => c.onchange = () => { const it = l.items.find(i => i.id === c.dataset.item); it.done = c.checked; if (l.items.every(i => i.done)) l.status = 'done'; else if (l.status === 'done') l.status = 'active'; else if (l.status === 'planned' && c.checked) l.status = 'active'; save(); render(); });
  });
}

/* ---------------- Analytics ---------------- */
function renderStats(v) {
  const keys = rangeKeys(); const agg = aggStats(keys);
  const prevKeys = UI.range === 'day' ? [dateKey(addDays(new Date(), -1))] : UI.range === 'week' ? weekKeys(-1) : monthKeys(-1);
  const prev = aggStats(prevKeys);
  const delta = (a, b, unit = '') => { if (!prev.days) return ''; const d = a - b; return `<div class="delta ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? '▲' : d < 0 ? '▼' : '•'} ${Math.abs(d)}${unit} vs previous ${UI.range}</div>`; };
  const label = { day: 'Today', week: 'This week', month: 'This month' }[UI.range];
  v.innerHTML = `
    <div class="view-head">
      <div><h1>Analytics</h1><p class="sub">How you're performing across areas, by day, week and month.</p></div>
      <div class="seg">${['day', 'week', 'month'].map(r => `<button class="${UI.range === r ? 'on' : ''}" data-r="${r}">${r[0].toUpperCase() + r.slice(1)}</button>`).join('')}</div>
    </div>
    <div class="tiles">
      <div class="tile"><div class="lbl">${label} · completion</div><div class="val">${agg.rate}<small>%</small></div>${delta(agg.rate, prev.rate, ' pts')}</div>
      <div class="tile"><div class="lbl">Hours done</div><div class="val">${fmtHrs(agg.done)}</div><div class="delta">of ${fmtHrs(agg.planned)} planned</div></div>
      <div class="tile"><div class="lbl">Blocks done</div><div class="val">${agg.doneCount}</div><div class="delta">of ${agg.count}</div></div>
      <div class="tile"><div class="lbl">Tasks completed</div><div class="val">${tasksDoneIn(keys)}</div>${delta(tasksDoneIn(keys), tasksDoneIn(prevKeys))}</div>
      <div class="tile"><div class="lbl">Streak</div><div class="val">${streak()}<small>days</small></div><div class="delta">days at ≥50% completion</div></div>
      <div class="tile"><div class="lbl">Active days</div><div class="val">${agg.days}</div><div class="delta">of ${keys.length} in range</div></div>
      <div class="tile"><div class="lbl">Focus time</div><div class="val">${fmtDur(Math.round(focusMins(sessionsIn(keys))))}</div>${delta(Math.round(focusMins(sessionsIn(keys))), Math.round(focusMins(sessionsIn(prevKeys))), ' min')}</div>
      <div class="tile"><div class="lbl">Break time</div><div class="val">${fmtDur(Math.round(breakMins(sessionsIn(keys))))}</div><div class="delta">${sessionsIn(keys).filter(x => x.mode === 'focus').length} focus sessions</div></div>
    </div>
    <div class="chart-grid">
      <div class="card span2"><div class="card-head"><h3>Completion trend · ${UI.range === 'day' ? 'last 14 days' : UI.range === 'week' ? 'last 12 weeks' : 'last 12 months'}</h3><button class="btn ghost sm" data-tbl="trend">Table</button></div><div id="chTrend"></div></div>
      <div class="card"><div class="card-head"><h3>Hours done by area · ${label.toLowerCase()}</h3><button class="btn ghost sm" data-tbl="hours">Table</button></div><div id="chHours"></div></div>
      <div class="card"><div class="card-head"><h3>Completion by area · ${label.toLowerCase()}</h3><button class="btn ghost sm" data-tbl="areas">Table</button></div><div id="chAreas"></div></div>
      <div class="card span2"><div class="card-head"><h3>Consistency · last 20 weeks</h3></div><div id="chHeat"></div></div>
      <div class="card span2"><div class="card-head"><h3>Tasks completed · ${UI.range === 'day' ? 'per day' : UI.range === 'week' ? 'per week' : 'per month'}</h3><button class="btn ghost sm" data-tbl="tasks">Table</button></div><div id="chTasks"></div></div>
      <div class="card"><div class="card-head"><h3>Focus time by task · ${label.toLowerCase()}</h3><button class="btn ghost sm" data-tbl="bytask">Table</button></div><div id="chByTask"></div></div>
      <div class="card"><div class="card-head"><h3>Focus time by area · ${label.toLowerCase()}</h3><button class="btn ghost sm" data-tbl="focusarea">Table</button></div><div id="chFocusArea"></div></div>
      <div class="card span2"><div class="card-head"><h3>Focus vs break · ${UI.range === 'day' ? 'per day' : UI.range === 'week' ? 'per week' : 'per month'}</h3><button class="btn ghost sm" data-tbl="focus">Table</button></div><div id="chFocus"></div></div>
    </div>`;
  $$('[data-r]', v).forEach(b => b.onclick = () => { UI.range = b.dataset.r; render(); });
  $$('[data-tbl]', v).forEach(b => b.onclick = () => { UI.tables[b.dataset.tbl] = !UI.tables[b.dataset.tbl]; render(); });

  const per = periods();
  const trend = per.map(p => { const a = aggStats(p.keys); return { label: p.label, full: p.full, value: a.days ? a.rate : null, sub: a.days ? `${a.doneCount}/${a.count} blocks` : 'no data' }; });
  lineChart($('#chTrend'), trend, { unit: '%', table: UI.tables.trend, cols: ['Period', 'Completion', 'Blocks'] });

  const areaRows = S.areas.map(a => ({ id: a.id, label: a.name, color: areaColor(a.id), v: agg.areas[a.id] })).filter(r => r.v);
  hbarChart($('#chHours'), areaRows.map(r => ({ label: r.label, color: r.color, value: +(r.v.done / 60).toFixed(1), max: Math.max(...areaRows.map(x => x.v.planned / 60), 1), sub: `${fmtHrs(r.v.done)} of ${fmtHrs(r.v.planned)} planned`, fmt: x => x + 'h' })), { table: UI.tables.hours, cols: ['Area', 'Hours done', 'Planned'], rowsExtra: areaRows.map(r => fmtHrs(r.v.planned)) });
  hbarChart($('#chAreas'), areaRows.map(r => ({ label: r.label, color: r.color, value: pct(r.v.doneCount, r.v.count), max: 100, sub: `${r.v.doneCount} of ${r.v.count} blocks`, fmt: x => x + '%' })), { table: UI.tables.areas, cols: ['Area', 'Completion', 'Blocks'], rowsExtra: areaRows.map(r => `${r.v.doneCount}/${r.v.count}`) });
  heatmap($('#chHeat'));
  const tk = per.map(p => ({ label: p.label, full: p.full, value: tasksDoneIn(p.keys) }));
  vbarChart($('#chTasks'), tk, { table: UI.tables.tasks, cols: ['Period', 'Tasks'] });

  // focus time by task / learning item
  const fs = sessionsIn(keys).filter(x => x.mode === 'focus');
  const byRef = {};
  for (const x of fs) { const k = x.kind + ':' + (x.refId || ''); const r = byRef[k] || (byRef[k] = { label: x.title, area: x.area, mins: 0, kind: x.kind }); r.mins += x.mins; }
  const refRows = Object.values(byRef).sort((a, b) => b.mins - a.mins).slice(0, 10);
  const maxRef = Math.max(1, ...refRows.map(r => r.mins));
  hbarChart($('#chByTask'), refRows.map(r => ({ label: r.label, color: r.area ? areaColor(r.area) : 'var(--accent)', value: Math.round(r.mins), max: maxRef, sub: r.kind === 'learn' ? 'learning' : r.kind === 'task' ? 'task' : 'free focus', fmt: x => fmtDur(x) })), { table: UI.tables.bytask, cols: ['Task', 'Focus', 'Kind'], rowsExtra: refRows.map(r => r.kind) });
  const byArea = {};
  for (const x of fs) { const a = x.area || '_'; byArea[a] = (byArea[a] || 0) + x.mins; }
  const areaFocus = Object.entries(byArea).map(([a, m]) => ({ label: a === '_' ? 'No area' : areaName(a), color: a === '_' ? 'var(--accent)' : areaColor(a), value: Math.round(m), max: Math.max(1, ...Object.values(byArea)), fmt: x => fmtDur(x) })).sort((a, b) => b.value - a.value);
  hbarChart($('#chFocusArea'), areaFocus, { table: UI.tables.focusarea, cols: ['Area', 'Focus', ''] });
  const fp = per.map(p => { const ss = sessionsIn(p.keys); return { label: p.label, full: p.full, value: Math.round(focusMins(ss)), sub: `${fmtDur(Math.round(breakMins(ss)))} break` }; });
  vbarChart($('#chFocus'), fp, { table: UI.tables.focus, cols: ['Period', 'Focus min'], tip: p => `${fmtDur(p.value)} focus · ${p.sub}` });
}

/* ---- chart helpers (hand-rolled SVG) ---- */
const svgNS = 'http://www.w3.org/2000/svg';
function roundedH(x, y, w, h, r) { r = Math.min(r, w, h / 2); if (w <= 0) return ''; return `M${x},${y} H${x + w - r} a${r},${r} 0 0 1 ${r},${r} V${y + h - r} a${r},${r} 0 0 1 ${-r},${r} H${x} Z`; }
function roundedV(x, y, w, h, r) { r = Math.min(r, h, w / 2); if (h <= 0) return ''; return `M${x},${y + h} V${y + r} a${r},${r} 0 0 1 ${r},${-r} H${x + w - r} a${r},${r} 0 0 1 ${r},${r} V${y + h} Z`; }
function dataTable(cols, rows) { return `<div style="overflow-x:auto"><table class="datatable"><thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; }

function lineChart(el, pts, { unit = '', table, cols }) {
  const W = el.clientWidth || 600, H = 240, m = { t: 16, r: 18, b: 28, l: 38 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b, n = pts.length;
  const xs = i => m.l + (n === 1 ? pw / 2 : i * pw / (n - 1)); const ys = v => m.t + ph - (v / 100) * ph;
  let grid = ''; for (const g of [0, 25, 50, 75, 100]) grid += `<line x1="${m.l}" x2="${W - m.r}" y1="${ys(g)}" y2="${ys(g)}"/><text x="${m.l - 6}" y="${ys(g) + 4}" text-anchor="end">${g}${unit}</text>`;
  const segs = []; let cur = [];
  pts.forEach((p, i) => { if (p.value == null) { if (cur.length) segs.push(cur); cur = []; } else cur.push([xs(i), ys(p.value)]); }); if (cur.length) segs.push(cur);
  const path = segs.map(s => 'M' + s.map(p => p.join(',')).join(' L')).join(' ');
  const area = segs.map(s => `M${s[0][0]},${ys(0)} L` + s.map(p => p.join(',')).join(' L') + ` L${s[s.length - 1][0]},${ys(0)} Z`).join(' ');
  const every = Math.ceil(n / Math.max(3, Math.floor(pw / 70)));
  const labels = pts.map((p, i) => (i % every === 0 || i === n - 1) ? `<text x="${xs(i)}" y="${H - 8}" text-anchor="middle">${esc(p.label)}</text>` : '').join('');
  const dots = pts.map((p, i) => p.value == null ? '' : `<circle class="mark" cx="${xs(i)}" cy="${ys(p.value)}" r="3.5" fill="var(--c-blue)"/>`).join('');
  el.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><g class="grid">${grid}</g><line class="axis" x1="${m.l}" x2="${W - m.r}" y1="${ys(0)}" y2="${ys(0)}"/>
    <path class="area" d="${area}" fill="var(--c-blue)"/><path class="line" d="${path}" stroke="var(--c-blue)"/>${dots}${labels}
    <line class="cross" id="cross" x1="0" x2="0" y1="${m.t}" y2="${m.t + ph}" hidden/><circle id="hov" r="6" fill="var(--c-blue)" stroke="var(--surface)" stroke-width="2" hidden/>
    <rect class="hit" x="${m.l}" y="${m.t}" width="${pw}" height="${ph}"/></svg>${table ? dataTable(cols, pts.map(p => [p.full || p.label, p.value == null ? '—' : p.value + unit, p.sub || ''])) : ''}`;
  const svg = $('svg', el), hit = $('.hit', el), cross = $('#cross', el), hov = $('#hov', el);
  hit.addEventListener('mousemove', e => {
    const r = svg.getBoundingClientRect(); const x = (e.clientX - r.left) * (W / r.width);
    const i = clamp(Math.round((x - m.l) / (pw / Math.max(1, n - 1))), 0, n - 1); const p = pts[i];
    cross.hidden = false; cross.setAttribute('x1', xs(i)); cross.setAttribute('x2', xs(i));
    if (p.value != null) { hov.hidden = false; hov.setAttribute('cx', xs(i)); hov.setAttribute('cy', ys(p.value)); } else hov.hidden = true;
    showTip(e, `<b>${esc(p.full || p.label)}</b><br>${p.value == null ? 'No data' : p.value + unit}${p.sub ? ` · ${p.sub}` : ''}`);
  });
  hit.addEventListener('mouseleave', () => { cross.hidden = true; hov.hidden = true; hideTip(); });
}
function hbarChart(el, rows, { table, cols, rowsExtra = [] }) {
  if (!rows.length) { el.innerHTML = '<div class="empty">No data in this range yet</div>'; return; }
  const W = el.clientWidth || 500, rh = 30, m = { l: 96, r: 54 }, H = rows.length * rh + 8;
  const pw = W - m.l - m.r;
  let body = '';
  rows.forEach((r, i) => {
    const y = i * rh + 6, w = Math.max(0, (r.value / (r.max || 1)) * pw);
    body += `<text x="${m.l - 10}" y="${y + 13}" text-anchor="end" class="lbl">${esc(r.label.length > 13 ? r.label.slice(0, 12) + '…' : r.label)}</text>
      <rect x="${m.l}" y="${y}" width="${pw}" height="18" rx="4" fill="var(--surface-3)"/>
      <path class="bar" d="${roundedH(m.l, y, w, 18, 4)}" fill="${r.color}"/>
      <text x="${m.l + w + 8}" y="${y + 13}">${r.fmt(r.value)}</text>
      <rect class="hit" data-i="${i}" x="0" y="${y - 3}" width="${W}" height="${rh}"/>`;
  });
  el.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="height:${H}px">${body}</svg>${table ? dataTable(cols, rows.map((r, i) => [r.label, r.fmt(r.value), rowsExtra[i] || ''])) : ''}`;
  $$('.hit', el).forEach(h => { h.addEventListener('mousemove', e => { const r = rows[+h.dataset.i]; showTip(e, `<b>${esc(r.label)}</b><br>${r.fmt(r.value)}${r.sub ? ` · ${r.sub}` : ''}`); }); h.addEventListener('mouseleave', hideTip); });
}
function vbarChart(el, pts, { table, cols, tip }) {
  const W = el.clientWidth || 600, H = 200, m = { t: 14, r: 12, b: 28, l: 30 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b, n = pts.length;
  const max = Math.max(1, ...pts.map(p => p.value)); const step = max <= 5 ? 1 : Math.ceil(max / 4);
  const top = Math.ceil(max / step) * step;
  const ys = v => m.t + ph - (v / top) * ph; const bw = pw / n; const barW = Math.min(36, bw * 0.6);
  let grid = ''; for (let g = 0; g <= top; g += step) grid += `<line x1="${m.l}" x2="${W - m.r}" y1="${ys(g)}" y2="${ys(g)}"/><text x="${m.l - 6}" y="${ys(g) + 4}" text-anchor="end">${g}</text>`;
  const bars = pts.map((p, i) => { const x = m.l + i * bw + (bw - barW) / 2; return `<path class="bar" d="${roundedV(x, ys(p.value), barW, ph - (ys(p.value) - m.t), 4)}" fill="var(--c-blue)"/>${p.value ? `<text x="${x + barW / 2}" y="${ys(p.value) - 5}" text-anchor="middle">${p.value}</text>` : ''}<text x="${x + barW / 2}" y="${H - 8}" text-anchor="middle">${esc(p.label)}</text><rect class="hit" data-i="${i}" x="${m.l + i * bw}" y="${m.t}" width="${bw}" height="${ph}"/>`; }).join('');
  el.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="height:${H}px"><g class="grid">${grid}</g><line class="axis" x1="${m.l}" x2="${W - m.r}" y1="${ys(0)}" y2="${ys(0)}"/>${bars}</svg>${table ? dataTable(cols, pts.map(p => [p.full || p.label, p.value])) : ''}`;
  $$('.hit', el).forEach(h => { h.addEventListener('mousemove', e => { const p = pts[+h.dataset.i]; showTip(e, `<b>${esc(p.full || p.label)}</b><br>${tip ? tip(p) : `${p.value} task${p.value === 1 ? '' : 's'} completed`}`); }); h.addEventListener('mouseleave', hideTip); });
}
function heatmap(el) {
  const weeks = 20; const start = addDays(startOfWeek(new Date()), -(weeks - 1) * 7);
  const today = todayKey(); let cells = '';
  const col = r => r == null ? 'var(--surface-3)' : r >= 90 ? 'var(--seq-6)' : r >= 75 ? 'var(--seq-5)' : r >= 60 ? 'var(--seq-4)' : r >= 40 ? 'var(--seq-3)' : r >= 20 ? 'var(--seq-2)' : 'var(--seq-1)';
  for (let w = 0; w < weeks; w++) for (let d = 0; d < 7; d++) {
    const day = addDays(start, w * 7 + d); const k = dateKey(day); const s = dayStats(k);
    cells += `<div class="cell ${k > today ? 'future' : ''}" data-k="${k}" style="background:${k > today ? 'var(--surface-3)' : col(s ? s.rate : null)}"></div>`;
  }
  el.innerHTML = `<div class="heat">${cells}</div><div class="heat-legend">Less <i style="background:var(--surface-3)"></i><i style="background:var(--seq-1)"></i><i style="background:var(--seq-2)"></i><i style="background:var(--seq-3)"></i><i style="background:var(--seq-4)"></i><i style="background:var(--seq-5)"></i><i style="background:var(--seq-6)"></i> More · each cell is one day's completion (Mon–Sun top to bottom)</div>`;
  $$('.cell', el).forEach(c => { c.addEventListener('mousemove', e => { const s = dayStats(c.dataset.k); showTip(e, `<b>${fmtLong(parseKey(c.dataset.k))}</b><br>${s ? `${s.rate}% · ${s.doneCount}/${s.count} blocks · ${fmtHrs(s.done)}` : 'No data'}`); }); c.addEventListener('mouseleave', hideTip); c.onclick = () => { UI.date = c.dataset.k; UI.view = 'today'; render(); }; });
}

/* ---------------- Settings ---------------- */
function renderSettings(v) {
  const st = S.settings;
  const hours = Array.from({ length: 25 }, (_, h) => h);
  v.innerHTML = `
    <div class="view-head"><div><h1>Settings</h1><p class="sub">Security, your areas, and your data.</p></div></div>
    <div class="settings-grid">
      <div class="card">
        <div class="card-head"><h3>Profile & day</h3></div>
        <div class="field"><label>Your name</label><input class="input" id="sName" value="${esc(st.name)}" placeholder="Asif"></div>
        <div class="field-row">
          <div class="field"><label>Day starts</label><select class="input" id="sStart">${hours.slice(0, 23).map(h => `<option value="${h}" ${h === st.dayStart ? 'selected' : ''}>${fmt12(h * 60)}</option>`).join('')}</select></div>
          <div class="field"><label>Day ends</label><select class="input" id="sEnd">${hours.slice(1).map(h => `<option value="${h}" ${h === st.dayEnd ? 'selected' : ''}>${h === 24 ? 'Midnight' : fmt12(h * 60)}</option>`).join('')}</select></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Theme</label><select class="input" id="sTheme"><option value="dark" ${st.theme === 'dark' ? 'selected' : ''}>Dark</option><option value="light" ${st.theme === 'light' ? 'selected' : ''}>Light</option></select></div>
          <div class="field"><label>Auto-lock after (minutes, 0 = never)</label><input class="input" type="number" id="sLock" min="0" max="240" value="${st.autoLock}"></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Focus block (minutes)</label><input class="input" type="number" id="sFocus" min="5" max="180" step="5" value="${st.focusMin}"></div>
          <div class="field"><label>Break after each block (minutes)</label><input class="input" type="number" id="sBreak" min="1" max="60" value="${st.breakMin}"></div>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h3>Security</h3></div>
        <p class="small muted">Everything is encrypted in this browser with a key derived from your password (PBKDF2 · AES-256-GCM). Nothing leaves your device. There is no recovery if you forget it, so export a backup now and then.</p>
        <form id="pwForm" style="display:flex;flex-direction:column;gap:10px">
          <div class="field"><label>Current password</label><input class="input" type="password" id="pwOld" autocomplete="current-password" required></div>
          <div class="field-row">
            <div class="field"><label>New password</label><input class="input" type="password" id="pwNew" autocomplete="new-password" minlength="6" required></div>
            <div class="field"><label>Confirm</label><input class="input" type="password" id="pwNew2" autocomplete="new-password" required></div>
          </div>
          <div><button class="btn primary" type="submit">Change password</button></div>
        </form>
      </div>
      <div class="card">
        <div class="card-head"><h3>Areas</h3><button class="btn ghost sm" id="addArea">${ICONS.plus} Area</button></div>
        <p class="small muted">Areas group everything for analytics. Click a name to rename, click the swatch to recolor.</p>
        <div class="area-list">${S.areas.map(a => `<div class="area-row" style="--c:${areaColor(a.id)}" data-id="${a.id}"><span class="sw" data-color></span><input class="input" style="padding:5px 8px" value="${esc(a.name)}" data-name><span class="small muted">${(n => n + (n === 1 ? ' use' : ' uses'))(S.routine.filter(r => r.area === a.id).length + Object.values(S.days).reduce((n, d) => n + d.blocks.filter(b => b.area === a.id).length, 0))}</span><button class="btn ghost icon sm" data-del title="Delete">✕</button></div>`).join('')}</div>
      </div>
      <div class="card">
        <div class="card-head"><h3>Data</h3></div>
        <p class="small muted">Your data lives only in this browser. Export a JSON backup to keep it safe or move it to another device. The export file is <b>not</b> encrypted.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="exportBtn">Export backup</button><button class="btn" id="importBtn">Import backup</button><input type="file" id="importFile" accept="application/json" hidden></div>
        <div class="card-head" style="margin-top:8px"><h3>Shortcuts</h3></div>
        <p class="small muted"><span class="kbd">1</span>–<span class="kbd">7</span> switch sections · <span class="kbd">Space</span> start / pause timer · <span class="kbd">R</span> restart timer · <span class="kbd">N</span> new block / task · <span class="kbd">T</span> theme · <span class="kbd">L</span> lock · <span class="kbd">←</span> <span class="kbd">→</span> change day</p>
        <div class="card-head" style="margin-top:8px"><h3>Danger zone</h3></div>
        <div><button class="btn danger" id="wipeBtn">Erase everything</button></div>
      </div>
    </div>`;
  const apply = () => { st.name = $('#sName').value.trim(); st.dayStart = +$('#sStart').value; st.dayEnd = Math.max(st.dayStart + 1, +$('#sEnd').value); st.theme = $('#sTheme').value; st.autoLock = +$('#sLock').value; st.focusMin = clamp(+$('#sFocus').value || 45, 5, 180); st.breakMin = clamp(+$('#sBreak').value || 5, 1, 60); document.documentElement.dataset.theme = st.theme; save(); resetIdle(); };
  ['#sName', '#sStart', '#sEnd', '#sTheme', '#sLock', '#sFocus', '#sBreak'].forEach(s => $(s).addEventListener('change', apply));
  $('#pwForm').onsubmit = async e => {
    e.preventDefault();
    const old = $('#pwOld').value, nw = $('#pwNew').value, nw2 = $('#pwNew2').value;
    if (nw !== nw2) return toast('New passwords do not match');
    if (!(await Vault.verify(old))) return toast('Current password is wrong');
    await Vault.setPassword(nw); await saveNow(); toast('Password changed'); $('#pwForm').reset();
  };
  $('#addArea').onclick = () => openModal({ title: 'New area', fields: [{ k: 'name', label: 'Name', required: true, autofocus: true }, { k: 'color', label: 'Color', type: 'select', options: AREA_COLORS.map(c => ({ v: c, l: c })) }], values: { color: AREA_COLORS[S.areas.length % AREA_COLORS.length] }, onSave: x => { S.areas.push({ id: uid(), name: x.name, color: x.color }); save(); render(); } });
  $$('.area-row', v).forEach(row => {
    const a = S.areas.find(x => x.id === row.dataset.id);
    $('[data-name]', row).addEventListener('change', e => { a.name = e.target.value.trim() || a.name; save(); render(); });
    $('[data-color]', row).onclick = () => { a.color = AREA_COLORS[(AREA_COLORS.indexOf(a.color) + 1) % AREA_COLORS.length]; save(); render(); };
    $('[data-del]', row).onclick = async () => { if (S.areas.length <= 1) return toast('Keep at least one area'); if (await confirmModal('Delete area', `Delete "${esc(a.name)}"? Items using it move to "${esc(S.areas.find(x => x !== a).name)}".`, { label: 'Delete' })) { const fb = S.areas.find(x => x !== a).id; const mv = o => { if (o.area === a.id) o.area = fb; }; S.routine.forEach(mv); S.activities.forEach(mv); S.tasks.forEach(mv); S.learning.forEach(mv); Object.values(S.days).forEach(d => d.blocks.forEach(mv)); S.areas = S.areas.filter(x => x !== a); save(); render(); } };
  });
  $('#exportBtn').onclick = () => { const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `dayos-backup-${todayKey()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
  $('#importBtn').onclick = () => $('#importFile').click();
  $('#importFile').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { const data = JSON.parse(await f.text()); if (!data.areas || !data.tasks || !data.days) throw new Error('Not a DayOS backup'); if (await confirmModal('Import backup', 'Replace everything in this browser with the backup file?', { label: 'Import' })) { S = data; await saveNow(); render(); toast('Backup imported'); } }
    catch (err) { toast('Import failed: ' + err.message); }
  };
  $('#wipeBtn').onclick = async () => { if (await confirmModal('Erase everything', 'This deletes all data and your password from this browser. Export a backup first if you want to keep anything.', { word: 'ERASE', label: 'Erase' })) { Vault.wipe(); location.reload(); } };
}

/* ---------------- Lock screen & session ---------------- */
let idleTimer = null;
function resetIdle() {
  clearTimeout(idleTimer);
  if (S && S.settings.autoLock > 0) idleTimer = setTimeout(lock, S.settings.autoLock * 60000);
}
async function lock() {
  if (!S) return;
  await saveNow(); Vault.lock(); S = null; clearInterval(nowTimer); clearInterval(tickTimer); tickTimer = null; document.title = 'DayOS';
  $('#app').hidden = true; $('#view').innerHTML = ''; showLock();
}
function showLock() {
  const lk = $('#lock'); lk.hidden = false;
  const fresh = !Vault.exists();
  $('#lockSub').textContent = fresh ? 'Set a password to protect your planner' : 'Your private day planner';
  $('#lockFields').innerHTML = fresh
    ? `<div class="field"><label>Choose a password</label><input class="input" type="password" id="pw" autocomplete="new-password" minlength="6" required autofocus></div>
       <div class="field" style="margin-top:10px"><label>Confirm password</label><input class="input" type="password" id="pw2" autocomplete="new-password" required></div>`
    : `<div class="field"><label>Password</label><input class="input" type="password" id="pw" autocomplete="current-password" required autofocus></div>`;
  $('#lockBtn').textContent = fresh ? 'Create & open' : 'Unlock';
  $('#lockHint').innerHTML = fresh
    ? 'Your data is encrypted with this password and stored only in this browser. There is no reset email, so pick something you will remember.'
    : 'Forgot it? Data cannot be recovered without the password. <a href="#" id="forgot">Erase and start over</a>.';
  $('#lockErr').textContent = '';
  setTimeout(() => $('#pw')?.focus(), 50);
  $('#forgot')?.addEventListener('click', async e => { e.preventDefault(); if (await confirmModal('Erase and start over', 'This permanently deletes the encrypted data in this browser.', { word: 'ERASE', label: 'Erase' })) { Vault.wipe(); location.reload(); } });
  $('#lockForm').onsubmit = async e => {
    e.preventDefault();
    const btn = $('#lockBtn'); btn.disabled = true; $('#lockErr').textContent = '';
    try {
      const pw = $('#pw').value;
      if (fresh) {
        if (pw.length < 6) throw new Error('Use at least 6 characters');
        if (pw !== $('#pw2').value) throw new Error('Passwords do not match');
        await Vault.setPassword(pw); S = defaultState(); await saveNow();
      } else {
        S = await Vault.open(pw);
        migrate();
      }
      enter();
    } catch (err) { $('#lockErr').textContent = fresh ? err.message : 'Wrong password'; }
    btn.disabled = false;
  };
}
function migrate() {
  S.settings = { name: '', theme: 'dark', dayStart: 6, dayEnd: 24, autoLock: 15, focusMin: 45, breakMin: 5, autoBreak: true, notify: true, ...S.settings };
  S.learning ||= []; S.activities ||= []; S.tasks ||= []; S.days ||= {}; S.routine ||= []; S.sessions ||= []; S.timer ||= null;
}
function enter() {
  $('#lock').hidden = true; $('#app').hidden = false; UI.date = todayKey(); UI.view = 'today';
  if (S.timer && !S.timer.pausedAt && Timer.remainingMs() <= 0) Timer.complete();
  if (S.timer) startTick();
  render(); resetIdle();
}

/* ---------------- Global events ---------------- */
$('#themeBtn').onclick = () => { S.settings.theme = S.settings.theme === 'dark' ? 'light' : 'dark'; save(); render(); };
$('#lockNowBtn').onclick = lock;
['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(ev => document.addEventListener(ev, resetIdle, { passive: true }));
document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });
window.addEventListener('beforeunload', () => saveNow());
window.addEventListener('resize', debounce(() => { if (S && UI.view === 'stats') render(); }, 200));
document.addEventListener('keydown', e => {
  if (!S || e.metaKey || e.ctrlKey || e.altKey) return;
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || $('.modal-bg');
  if (typing) return;
  const k = e.key.toLowerCase();
  if (k >= '1' && k <= '7') { UI.view = VIEWS[+k - 1].id; render(); }
  else if (k === 'r' && S.timer) Timer.restart();
  else if (k === ' ') { e.preventDefault(); if (S.timer) { S.timer.pausedAt ? Timer.resume() : Timer.pause(); } else if (UI.view === 'timer') $('#tStart')?.click(); }
  else if (k === 'l') lock();
  else if (k === 't') $('#themeBtn').click();
  else if (k === 'n') { if (UI.view === 'today') $('#addBlock')?.click(); else if (UI.view === 'board') $('#addTask')?.click(); else if (UI.view === 'learn') $('#addLearn')?.click(); else if (UI.view === 'routine') $('#addRoutine')?.click(); }
  else if (k === 'arrowleft' && UI.view === 'today') $('#prevDay')?.click();
  else if (k === 'arrowright' && UI.view === 'today') $('#nextDay')?.click();
});

/* ---------------- Boot ---------------- */
if (!window.crypto?.subtle) {
  $('#lockFields').innerHTML = '<p class="err">This browser does not expose the Web Crypto API here. Open the app over https:// (GitHub Pages) or http://localhost.</p>';
  $('#lockBtn').hidden = true;
} else {
  showLock();
}
