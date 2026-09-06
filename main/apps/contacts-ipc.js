const path = require("path");
const fs = require("fs");
const { app, shell, clipboard, Notification } = require("electron");
const { loadJsonFile, saveJsonFile } = require("./safe-json-store");
const { reportLoadFailure, reportSaveFailure } = require("../resolve/report-helper");
const {
  setupLocalAuthApp,
  requireSignedIn,
  registerSingleFileMigrator,
} = require("./local-auth-app-helper");

const APP_ID = "contacts";
const auth = setupLocalAuthApp(APP_ID);
registerSingleFileMigrator(APP_ID, "contacts.json");

const DATA_FILE = () => auth.userDataPath("data.json");

function signedInGuard() {
  return requireSignedIn(auth);
}

const DEFAULT_GROUPS = [
  { id: "family", name: "Family", icon: "👨‍👩‍👧", color: "#f48fb1" },
  { id: "friends", name: "Friends", icon: "🤝", color: "#6ec6ff" },
  { id: "work", name: "Work", icon: "💼", color: "#ffb74d" },
  { id: "other", name: "Other", icon: "📇", color: "#8b9dc3" },
];

let reminderTimer = null;
const firedThisMinute = new Set();

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function displayName(c) {
  if (c.displayName) return c.displayName.trim();
  const parts = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
  return parts || c.name || "Unnamed";
}

function normalizeEmail(raw) {
  if (!raw?.value?.trim()) return null;
  return { id: raw.id || uid("em"), label: String(raw.label || "Email").trim(), value: String(raw.value).trim() };
}

function normalizePhone(raw) {
  if (!raw?.value?.trim()) return null;
  return { id: raw.id || uid("ph"), label: String(raw.label || "Mobile").trim(), value: String(raw.value).trim() };
}

function normalizeReminder(raw) {
  if (!raw?.title?.trim() && !raw?.date) return null;
  return {
    id: String(raw.id || uid("rem")),
    title: String(raw.title || "").trim() || "Reminder",
    date: String(raw.date || "").trim(),
    time: String(raw.time || "09:00").trim(),
    repeat: ["none", "daily", "weekly", "monthly", "yearly"].includes(raw.repeat) ? raw.repeat : "none",
    enabled: raw.enabled !== false,
    lastTriggered: raw.lastTriggered || null,
  };
}

function normalizeContact(raw) {
  if (!raw) return null;
  const firstName = String(raw.firstName || raw.name || "").trim();
  const lastName = String(raw.lastName || "").trim();
  if (!firstName && !lastName && !raw.displayName) return null;

  return {
    id: String(raw.id || uid("con")),
    firstName,
    lastName,
    displayName: String(raw.displayName || "").trim(),
    icon: String(raw.icon || "👤").trim() || "👤",
    groupId: String(raw.groupId || "other"),
    company: String(raw.company || "").trim(),
    jobTitle: String(raw.jobTitle || "").trim(),
    address: String(raw.address || "").trim(),
    birthday: String(raw.birthday || "").trim(),
    emails: (Array.isArray(raw.emails) ? raw.emails : raw.email ? [{ label: "Email", value: raw.email }] : [])
      .map(normalizeEmail)
      .filter(Boolean),
    phones: (Array.isArray(raw.phones) ? raw.phones : raw.phone ? [{ label: "Mobile", value: raw.phone }] : [])
      .map(normalizePhone)
      .filter(Boolean),
    notes: String(raw.notes || "").trim(),
    tags: Array.isArray(raw.tags) ? raw.tags.map((t) => String(t).trim()).filter(Boolean) : [],
    favorite: Boolean(raw.favorite),
    relatedProfileId: String(raw.relatedProfileId || "").trim(),
    reminders: (Array.isArray(raw.reminders) ? raw.reminders : []).map(normalizeReminder).filter(Boolean),
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
  };
}

function normalizeGroup(raw) {
  if (!raw?.name?.trim()) return null;
  return {
    id: String(raw.id || uid("grp")),
    name: String(raw.name).trim(),
    icon: String(raw.icon || "📁").trim() || "📁",
    color: String(raw.color || "#8b9dc3").trim(),
  };
}

function normalizeStorage(raw) {
  const groups =
    Array.isArray(raw?.groups) && raw.groups.length
      ? raw.groups.map(normalizeGroup).filter(Boolean)
      : DEFAULT_GROUPS.map((g) => ({ ...g }));

  const contacts = (Array.isArray(raw?.contacts) ? raw.contacts : [])
    .map(normalizeContact)
    .filter(Boolean);

  return {
    groups,
    contacts,
    settings: {
      birthdayReminders: raw?.settings?.birthdayReminders !== false,
      birthdayReminderTime: String(raw?.settings?.birthdayReminderTime || "09:00"),
      reminderCheckMinutes: Math.min(60, Math.max(1, parseInt(raw?.settings?.reminderCheckMinutes, 10) || 1)),
    },
  };
}

async function loadStorage() {
  const loaded = loadJsonFile(DATA_FILE(), { fallback: {} });
  if (!loaded.ok) {
    reportLoadFailure("contacts", loaded);
    return { ok: false, error: loaded.error };
  }
  return { ok: true, data: normalizeStorage(loaded.data || {}) };
}

async function saveStorage(args) {
  const data = normalizeStorage(args?.data ?? args);
  const result = saveJsonFile(DATA_FILE(), data, { listKey: "contacts" });
  if (!result.ok) {
    reportSaveFailure("contacts", result);
    return { ok: false, error: result.error, data: result.data ? normalizeStorage(result.data) : undefined };
  }
  return { ok: true, data };
}

function parseBirthdayMMDD(birthday) {
  if (!birthday) return null;
  const s = birthday.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.slice(5);
  if (/^\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{2}\/\d{2}$/.test(s)) {
    const [m, d] = s.split("/");
    return `${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

function todayKey() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function nowTimeHM() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}

function todayMMDD() {
  const n = new Date();
  return `${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function matchesReminderToday(reminder, contact, settings) {
  if (!reminder.enabled) return false;
  const nowDate = todayKey();
  const nowTime = nowTimeHM();
  const targetTime = reminder.time || settings.birthdayReminderTime || "09:00";

  if (nowTime !== targetTime) return false;

  const fireKey = `${reminder.id}:${nowDate}:${nowTime}`;
  if (firedThisMinute.has(fireKey)) return false;
  if (reminder.lastTriggered === `${nowDate}T${nowTime}`) return false;

  if (reminder.repeat === "none") {
    return reminder.date === nowDate;
  }
  if (reminder.repeat === "daily") return true;
  if (reminder.repeat === "weekly") {
    const d = new Date();
    return d.getDay() === new Date(reminder.date || nowDate).getDay();
  }
  if (reminder.repeat === "monthly") {
    return (reminder.date || "").slice(-2) === nowDate.slice(-2);
  }
  if (reminder.repeat === "yearly") {
    const mmdd = reminder.date?.slice(5) || reminder.date;
    return mmdd === todayMMDD();
  }
  return false;
}

function showNotification(title, body, meta = {}) {
  try {
    const { push } = require("./notifications-center");
    push({
      appId: "contacts",
      type: meta.type || "reminder",
      title: String(title || "Contacts"),
      body: String(body || ""),
      dedupeKey: meta.dedupeKey || null,
      route: meta.route || { page: "people" },
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

async function checkReminders() {
  const loaded = await loadStorage();
  if (!loaded.ok) return loaded;
  const data = loaded.data;
  const triggered = [];
  let dirty = false;

  for (const contact of data.contacts) {
    const name = displayName(contact);

    if (data.settings.birthdayReminders && contact.birthday) {
      const bday = parseBirthdayMMDD(contact.birthday);
      if (bday === todayMMDD()) {
        const time = data.settings.birthdayReminderTime || "09:00";
        const fireKey = `bday:${contact.id}:${todayKey()}:${time}`;
        if (nowTimeHM() === time && !firedThisMinute.has(fireKey)) {
          showNotification(`Birthday — ${name}`, `Today is ${name}'s birthday.`, {
            type: "birthday",
            dedupeKey: fireKey,
            route: { page: "people", contactId: contact.id },
          });
          firedThisMinute.add(fireKey);
          triggered.push({ contactId: contact.id, name, type: "birthday" });
        }
      }
    }

    for (const rem of contact.reminders || []) {
      if (matchesReminderToday(rem, contact, data.settings)) {
        const fireKey = `${rem.id}:${todayKey()}:${nowTimeHM()}`;
        showNotification(name, rem.title, {
          type: "reminder",
          dedupeKey: fireKey,
          route: { page: "people", contactId: contact.id },
        });
        firedThisMinute.add(fireKey);
        rem.lastTriggered = `${todayKey()}T${nowTimeHM()}`;
        dirty = true;
        triggered.push({ contactId: contact.id, name, type: "reminder", title: rem.title });
      }
    }
  }

  if (dirty) await saveStorage({ data });
  return { ok: true, triggered, checkedAt: new Date().toISOString() };
}

function startReminderService() {
  if (reminderTimer) return;
  checkReminders().catch(() => {});
  reminderTimer = setInterval(() => {
    firedThisMinute.clear();
    checkReminders().catch(() => {});
  }, 60 * 1000);
}

function stopReminderService() {
  if (reminderTimer) {
    clearInterval(reminderTimer);
    reminderTimer = null;
  }
}

async function openEmail(args) {
  const email = String(args?.email || "").trim();
  if (!email) return { ok: false, error: "Email required" };
  await shell.openExternal(`mailto:${encodeURIComponent(email)}`);
  return { ok: true };
}

async function openPhone(args) {
  const phone = String(args?.phone || "").trim().replace(/\s/g, "");
  if (!phone) return { ok: false, error: "Phone required" };
  await shell.openExternal(`tel:${phone}`);
  return { ok: true };
}

async function openSms(args) {
  const phone = String(args?.phone || "").trim().replace(/\s/g, "");
  if (!phone) return { ok: false, error: "Phone required" };
  await shell.openExternal(`sms:${phone}`);
  return { ok: true };
}

function copyText(args) {
  clipboard.writeText(String(args?.text ?? ""));
  return { ok: true };
}

async function getUpcoming() {
  const loaded = await loadStorage();
  if (!loaded.ok) return loaded;
  const upcoming = [];
  const today = new Date();
  const todayMMDDStr = todayMMDD();

  for (const c of loaded.data.contacts) {
    const name = displayName(c);
    if (c.birthday) {
      const bday = parseBirthdayMMDD(c.birthday);
      if (bday) {
        const [m, d] = bday.split("-").map(Number);
        let next = new Date(today.getFullYear(), m - 1, d);
        if (next < today) next = new Date(today.getFullYear() + 1, m - 1, d);
        const days = Math.ceil((next - today) / (86400000));
        upcoming.push({ type: "birthday", contactId: c.id, name, date: bday, daysUntil: days, icon: c.icon });
      }
    }
    for (const r of c.reminders || []) {
      if (!r.enabled) continue;
      upcoming.push({
        type: "reminder",
        contactId: c.id,
        name,
        title: r.title,
        date: r.date,
        time: r.time,
        repeat: r.repeat,
        icon: c.icon,
      });
    }
  }

  upcoming.sort((a, b) => (a.daysUntil ?? 999) - (b.daysUntil ?? 999));
  return { ok: true, upcoming: upcoming.slice(0, 50) };
}

async function addContact(args) {
  const loaded = await loadStorage();
  if (!loaded.ok) return loaded;
  const data = loaded.data;
  const contact = normalizeContact({
    firstName: args?.firstName,
    lastName: args?.lastName,
    displayName: args?.displayName || args?.name,
    email: args?.email,
    emails: args?.emails,
    phone: args?.phone,
    phones: args?.phones,
    groupId: args?.groupId,
    company: args?.company,
    notes: args?.notes,
    favorite: args?.favorite,
  });
  if (!contact) return { ok: false, error: "Name required" };
  contact.updatedAt = new Date().toISOString();
  data.contacts.push(contact);
  const saved = await saveStorage({ data });
  if (!saved.ok) return saved;
  return { ok: true, contact, data: saved.data };
}

async function deleteContact(args) {
  const id = String(args?.id || "").trim();
  if (!id) return { ok: false, error: "Contact id required" };
  const loaded = await loadStorage();
  if (!loaded.ok) return loaded;
  const data = loaded.data;
  const before = data.contacts.length;
  data.contacts = data.contacts.filter((c) => c.id !== id);
  if (data.contacts.length === before) return { ok: false, error: "Contact not found" };
  const saved = await saveStorage({ data });
  if (!saved.ok) return saved;
  return { ok: true, data: saved.data };
}

async function exportData() {
  const loaded = await loadStorage();
  if (!loaded.ok) return loaded;
  return { ok: true, json: JSON.stringify(loaded.data, null, 2) };
}

async function importData(args) {
  try {
    const parsed = typeof args?.json === "string" ? JSON.parse(args.json) : args?.data;
    return saveStorage({ data: parsed });
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

const CHANNELS = {
  "storage.load": () => loadStorage(),
  "storage.save": (args) => saveStorage(args),
  "contact.add": (args) => addContact(args),
  "contact.delete": (args) => deleteContact(args),
  "email.open": (args) => openEmail(args),
  "phone.open": (args) => openPhone(args),
  "sms.open": (args) => openSms(args),
  "clipboard.copy": (args) => copyText(args),
  "reminders.check": () => checkReminders(),
  "reminders.upcoming": () => getUpcoming(),
  "notify.test": (args) => {
    showNotification(String(args?.title || "Contact"), String(args?.body || "Test notification"));
    return { ok: true };
  },
  "data.export": () => exportData(),
  "data.import": (args) => importData(args),
};

async function handleContactsInvoke(channel, args) {
  const authErr = signedInGuard();
  if (authErr) return authErr;
  const handler = CHANNELS[channel];
  if (!handler) return { ok: false, error: `Unknown channel: ${channel}` };
  try {
    return await handler(args);
  } catch (err) {
    return { ok: false, error: err.message || "Request failed" };
  }
}

module.exports = { handleContactsInvoke, startReminderService, stopReminderService };