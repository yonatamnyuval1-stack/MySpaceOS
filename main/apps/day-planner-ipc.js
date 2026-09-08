const path = require("path");
const fs = require("fs");
const { app, Notification } = require("electron");
const { publishScreenFacts, getScreenFacts } = require("../ai/screen-facts-store");
const { loadJsonFile, saveJsonFile } = require("./safe-json-store");
const { reportLoadFailure, reportSaveFailure } = require("../resolve/report-helper");

const {
  setupLocalAuthApp,
  requireSignedIn,
  userStorageRoot,
  registerLegacyMigrator,
  registerSingleFileMigrator,
} = require("./local-auth-app-helper");

const APP_ID = "day-planner";
const auth = setupLocalAuthApp(APP_ID);
registerSingleFileMigrator(APP_ID, "day-planner.json");

const DATA_FILE = () => auth.userDataPath("data.json");

function signedInGuard() {
  return requireSignedIn(auth);
}


const WM_ROOT = path.join(__dirname, "..", "..", "world-maps");
const { geminiGenerate } = require(path.join(WM_ROOT, "gemini-ipc.js"));

let reminderTimer = null;
const firedThisMinute = new Set();

function dataPath() {
  return DATA_FILE();
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function todayISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function nowTimeHM(d = new Date()) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function addDaysISO(iso, days) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return todayISO(d);
}

function normalizePriority(raw) {
  const p = String(raw || "normal").toLowerCase();
  if (["low", "normal", "high", "urgent"].includes(p)) return p;
  return "normal";
}

function normalizeTime(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function normalizeTask(raw) {
  if (!raw) return null;
  const title = String(raw.title || raw.text || "").trim();
  if (!title) return null;
  const done = Boolean(raw.done);
  const dueTime = normalizeTime(raw.dueTime ?? raw.time);
  const notify = Boolean(raw.notify) && Boolean(dueTime);
  return {
    id: String(raw.id || uid("task")),
    title,
    notes: String(raw.notes || "").trim(),
    dueDate: String(raw.dueDate || todayISO()).slice(0, 10),
    dueTime,
    notify,
    notifiedAt: raw.notifiedAt ? String(raw.notifiedAt) : null,
    priority: normalizePriority(raw.priority),
    done,
    doneAt: done ? String(raw.doneAt || new Date().toISOString()) : null,
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
  };
}

function normalizeStorage(raw) {
  return {
    tasks: (Array.isArray(raw?.tasks) ? raw.tasks : []).map(normalizeTask).filter(Boolean),
  };
}

function loadStorage() {
  const loaded = loadJsonFile(dataPath(), { fallback: {} });
  if (!loaded.ok) {
    console.error("day-planner load:", loaded.error);
    reportLoadFailure("day-planner", loaded);
    return normalizeStorage({});
  }
  return normalizeStorage(loaded.data || {});
}

function saveStorage(data) {
  const normalized = normalizeStorage(data);
  const result = saveJsonFile(dataPath(), normalized, { listKey: "tasks" });
  if (!result.ok) {
    reportSaveFailure("day-planner", result);
    if (result.data) return normalizeStorage(result.data);
  }
  return normalized;
}

function bucketForTask(task, today) {
  if (task.done) return "done";
  const due = String(task.dueDate || today).slice(0, 10);
  if (due <= today) return "today";
  if (due === addDaysISO(today, 1)) return "tomorrow";
  return "later";
}

function sortAgenda(a, b) {
  const ta = a.dueTime || "99:99";
  const tb = b.dueTime || "99:99";
  if (ta !== tb) return ta.localeCompare(tb);
  const pr = { urgent: 0, high: 1, normal: 2, low: 3 };
  const pd = (pr[a.priority] ?? 2) - (pr[b.priority] ?? 2);
  if (pd) return pd;
  return a.title.localeCompare(b.title);
}

function listBuckets(tasks) {
  const today = todayISO();
  const groups = { today: [], tomorrow: [], later: [], done: [] };
  for (const t of tasks) {
    groups[bucketForTask(t, today)].push(t);
  }
  groups.today.sort(sortAgenda);
  groups.tomorrow.sort(sortAgenda);
  groups.later.sort(sortAgenda);
  groups.done.sort((a, b) => String(b.doneAt || "").localeCompare(String(a.doneAt || "")));
  return {
    today,
    now: nowTimeHM(),
    buckets: groups,
    counts: {
      today: groups.today.length,
      tomorrow: groups.tomorrow.length,
      later: groups.later.length,
      done: groups.done.length,
      open: groups.today.length + groups.tomorrow.length + groups.later.length,
    },
  };
}

function addMinutesToTask(task, minutes) {
  const baseDate = String(task.dueDate || todayISO()).slice(0, 10);
  const baseTime = task.dueTime || nowTimeHM();
  const d = new Date(`${baseDate}T${baseTime}:00`);
  if (Number.isNaN(d.getTime())) {
    const fallback = new Date();
    fallback.setMinutes(fallback.getMinutes() + minutes);
    return {
      dueDate: todayISO(fallback),
      dueTime: nowTimeHM(fallback),
    };
  }
  d.setMinutes(d.getMinutes() + minutes);
  return {
    dueDate: todayISO(d),
    dueTime: nowTimeHM(d),
  };
}

function showNotification(title, body, meta = {}) {
  try {
    const { push } = require("./notifications-center");
    push({
      appId: "day-planner",
      type: meta.type || "task-due",
      title: String(title || "Today"),
      body: String(body || ""),
      dedupeKey: meta.dedupeKey || null,
      route: meta.route || { page: "today" },
      priority: "high",
    });
    return true;
  } catch {
  }
  try {
    const { allowNotify } = require("./focus-gate");
    if (!allowNotify()) return false;
  } catch {
  }
  if (!Notification.isSupported()) return false;
  new Notification({ title, body, silent: false }).show();
  return true;
}

function checkTaskReminders() {
  const data = loadStorage();
  const today = todayISO();
  const hm = nowTimeHM();
  let dirty = false;
  const triggered = [];

  for (const task of data.tasks) {
    if (task.done || !task.notify || !task.dueTime) continue;
    if (task.dueDate !== today) continue;
    if (task.dueTime !== hm) continue;

    const fireKey = `${task.id}:${today}:${hm}`;
    if (firedThisMinute.has(fireKey)) continue;
    if (task.notifiedAt === `${today}T${hm}`) continue;

    showNotification("Today", task.title + (task.notes ? ` — ${task.notes}` : ""), {
      type: "task-due",
      dedupeKey: `today:${fireKey}`,
      route: { page: "today", taskId: task.id },
    });
    firedThisMinute.add(fireKey);
    task.notifiedAt = `${today}T${hm}`;
    task.updatedAt = new Date().toISOString();
    dirty = true;
    triggered.push({ id: task.id, title: task.title, time: hm });
  }

  if (dirty) saveStorage(data);
  return { ok: true, triggered, checkedAt: new Date().toISOString() };
}

function startDayPlannerReminderService() {
  if (reminderTimer) return;
  checkTaskReminders();
  reminderTimer = setInterval(() => {
    firedThisMinute.clear();
    try {
      checkTaskReminders();
    } catch {
    }
  }, 60 * 1000);
}

function stopDayPlannerReminderService() {
  if (reminderTimer) {
    clearInterval(reminderTimer);
    reminderTimer = null;
  }
}

function parseModelJson(raw) {
  const text = String(raw || "").trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : text;
  const start = candidate.indexOf("[");
  const end = candidate.lastIndexOf("]");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {
    }
  }
  const oStart = candidate.indexOf("{");
  const oEnd = candidate.lastIndexOf("}");
  if (oStart >= 0 && oEnd > oStart) {
    try {
      const obj = JSON.parse(candidate.slice(oStart, oEnd + 1));
      if (Array.isArray(obj.tasks)) return obj.tasks;
      return obj;
    } catch {
      return null;
    }
  }
  return null;
}

async function generateTasks({ goal, language, count }) {
  const lang = String(language || "en").toLowerCase().startsWith("he") ? "he" : "en";
  const n = Math.max(3, Math.min(15, Number(count) || 6));
  const goalText = String(goal || "").trim();
  if (!goalText) return { ok: false, error: lang === "he" ? "חסרה מטרה" : "Goal is required" };

  const today = todayISO();
  const langRule =
    lang === "he" ? "Write task titles in Hebrew." : "Write task titles in English.";

  const prompt =
    `Break this goal into actionable day-planner agenda items with times.\n` +
    `Goal: ${goalText}\n` +
    `${langRule}\n` +
    `Today's date: ${today}\n` +
    `Return ONLY JSON:\n` +
    `{"summary":"one sentence","tasks":[{"title":"...","notes":"optional","dueOffsetDays":0,"dueTime":"HH:MM","notify":true,"priority":"normal|high|low"}]}\n` +
    `Rules:\n` +
    `- Exactly ${n} tasks.\n` +
    `- dueOffsetDays: 0=today, 1=tomorrow, 2+=later (max 14).\n` +
    `- dueTime in 24h HH:MM, spread through the day.\n` +
    `- notify true for timed items.\n` +
    `- Concrete verbs, no fluff.`;

  let system = "You break goals into timed planner tasks.";
  try {
    const { gatherMslAiContext } = require("../msl/ai-context");
    const msl = await gatherMslAiContext("day-planner", { label: "Today" });
    if (msl.promptBlock) system += msl.promptBlock.slice(0, 6000);
  } catch {
  }

  const res = await geminiGenerate({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    systemInstruction: system,
    temperature: 0.45,
    maxOutputTokens: 2048,
  });
  if (!res.ok) return res;

  const parsed = parseModelJson(String(res.text || "").trim());
  const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.tasks) ? parsed.tasks : [];
  const tasks = list
    .map((t, i) => {
      const offset = Math.max(0, Math.min(14, Number(t.dueOffsetDays) || 0));
      const fallbackHour = 9 + i;
      const fallbackTime = `${String(Math.min(20, fallbackHour)).padStart(2, "0")}:00`;
      return normalizeTask({
        title: t.title || t.text,
        notes: t.notes || "",
        dueDate: addDaysISO(today, offset),
        dueTime: t.dueTime || t.time || fallbackTime,
        notify: t.notify !== false,
        priority: t.priority || "normal",
      });
    })
    .filter(Boolean)
    .slice(0, n);

  if (!tasks.length) {
    return {
      ok: false,
      error: lang === "he" ? "לא הצלחתי לייצר משימות" : "Could not generate tasks",
      raw: String(res.text || "").slice(0, 400),
    };
  }

  return {
    ok: true,
    tasks,
    summary: !Array.isArray(parsed) ? parsed?.summary || null : null,
    model: res.model,
  };
}

function listResult() {
  const data = loadStorage();
  return { ok: true, tasks: data.tasks, ...listBuckets(data.tasks) };
}

async function handleDayPlannerInvoke(channel, args = {}) {
  const authErr = signedInGuard();
  if (authErr) return authErr;
  switch (channel) {
    case "storage.load":
      return { ok: true, data: loadStorage() };

    case "storage.save":
      return { ok: true, data: saveStorage(args?.data || args || {}) };

    case "tasks.list":
      return listResult();

    case "task.add": {
      try {
        const data = loadStorage();
        const task = normalizeTask({
          title: args?.title,
          notes: args?.notes,
          dueDate: args?.dueDate || todayISO(),
          dueTime: args?.dueTime ?? args?.time,
          notify: args?.notify,
          priority: args?.priority,
        });
        if (!task) return { ok: false, error: "Title is required" };
        data.tasks.unshift(task);
        saveStorage(data);
        return { ok: true, task, ...listBuckets(data.tasks) };
      } catch (err) {
        return { ok: false, error: err?.message || String(err) };
      }
    }

    case "task.update": {
      const data = loadStorage();
      const idx = data.tasks.findIndex((t) => t.id === args?.id);
      if (idx < 0) return { ok: false, error: "Task not found" };
      const prev = data.tasks[idx];
      let done = args?.done != null ? Boolean(args.done) : prev.done;
      const nextNotify = args?.notify != null ? Boolean(args.notify) : prev.notify;
      data.tasks[idx] = normalizeTask({
        ...prev,
        title: args?.title ?? prev.title,
        notes: args?.notes ?? prev.notes,
        dueDate: args?.dueDate ?? prev.dueDate,
        dueTime: args?.dueTime !== undefined ? args.dueTime : prev.dueTime,
        notify: nextNotify,
        notifiedAt: args?.notifiedAt !== undefined ? args.notifiedAt : prev.notifiedAt,
        priority: args?.priority ?? prev.priority,
        done,
        doneAt: done ? args?.doneAt || prev.doneAt || new Date().toISOString() : null,
        id: prev.id,
        createdAt: prev.createdAt,
        updatedAt: new Date().toISOString(),
      });
      saveStorage(data);
      return { ok: true, task: data.tasks[idx], ...listBuckets(data.tasks) };
    }

    case "task.toggle": {
      const data = loadStorage();
      const idx = data.tasks.findIndex((t) => t.id === args?.id);
      if (idx < 0) return { ok: false, error: "Task not found" };
      const prev = data.tasks[idx];
      const done = !prev.done;
      data.tasks[idx] = normalizeTask({
        ...prev,
        done,
        doneAt: done ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
      });
      saveStorage(data);
      return { ok: true, task: data.tasks[idx], ...listBuckets(data.tasks) };
    }

    case "task.snooze": {
      const data = loadStorage();
      const idx = data.tasks.findIndex((t) => t.id === args?.id);
      if (idx < 0) return { ok: false, error: "Task not found" };
      const prev = data.tasks[idx];
      let dueDate;
      let dueTime;
      const preset = String(args?.preset || "").toLowerCase();
      if (preset === "tomorrow" || preset === "tomorrow-am") {
        dueDate = addDaysISO(todayISO(), 1);
        dueTime = normalizeTime(args?.time) || "09:00";
      } else {
        const minutes = Math.max(5, Math.min(24 * 60, Number(args?.minutes) || 15));
        const next = addMinutesToTask(prev, minutes);
        dueDate = next.dueDate;
        dueTime = next.dueTime;
      }
      data.tasks[idx] = normalizeTask({
        ...prev,
        dueDate,
        dueTime,
        notify: args?.notify != null ? Boolean(args.notify) : true,
        notifiedAt: null,
        done: false,
        doneAt: null,
        updatedAt: new Date().toISOString(),
      });
      saveStorage(data);
      return { ok: true, task: data.tasks[idx], ...listBuckets(data.tasks) };
    }

    case "task.delete": {
      const data = loadStorage();
      data.tasks = data.tasks.filter((t) => t.id !== args?.id);
      saveStorage(data);
      return { ok: true, ...listBuckets(data.tasks) };
    }

    case "tasks.clearDone": {
      const data = loadStorage();
      data.tasks = data.tasks.filter((t) => !t.done);
      saveStorage(data);
      return { ok: true, ...listBuckets(data.tasks) };
    }

    case "tasks.generate": {
      const gen = await generateTasks(args || {});
      if (!gen.ok) return gen;
      if (args?.apply !== false) {
        const data = loadStorage();
        data.tasks = [...(gen.tasks || []), ...data.tasks];
        saveStorage(data);
        return { ...gen, ...listBuckets(data.tasks) };
      }
      return gen;
    }

    case "reminders.check":
      return checkTaskReminders();

    case "screen.publish": {
      publishScreenFacts("day-planner", args || {});
      return { ok: true };
    }

    case "screen.get":
      return { ok: true, facts: getScreenFacts("day-planner") };

    case "meta":
      return { ok: true, name: "Today", version: "1.1.0", today: todayISO() };

    default:
      return { ok: false, error: `Unknown day-planner channel: ${channel}` };
  }
}

module.exports = {
  handleDayPlannerInvoke,
  startDayPlannerReminderService,
  stopDayPlannerReminderService,
};