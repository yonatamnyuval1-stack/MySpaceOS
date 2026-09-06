const path = require("path");
const fs = require("fs");
const { app, shell, clipboard, Notification } = require("electron");
const {
  deriveKey,
  encryptJson,
  decryptJson,
  verifyPassword,
  createAuthRecord,
} = require("./vault-crypto");

const {
  setupLocalAuthApp,
  requireSignedIn,
  userStorageRoot,
  registerLegacyMigrator,
  registerSingleFileMigrator,
} = require("./local-auth-app-helper");

const APP_ID = "coupons";
const auth = setupLocalAuthApp(APP_ID);
registerLegacyMigrator(APP_ID, ["coupons-vault.json", "coupons-expiry-meta.json"]);

const COUPONS_VAULT_JSON_FILE = () => auth.userDataPath("coupons-vault.json");
const COUPONS_EXPIRY_META_JSON_FILE = () => auth.userDataPath("coupons-expiry-meta.json");

function signedInGuard() {
  return requireSignedIn(auth);
}


const TYPES = ["gift", "voucher", "promo", "membership"];

function storePath() {
  return COUPONS_VAULT_JSON_FILE();
}

function metaPath() {
  return COUPONS_EXPIRY_META_JSON_FILE();
}

let session = null;
let expiryTimer = null;
const firedThisMinute = new Set();

function parseDateOnly(str) {
  if (!str) return null;
  const d = new Date(`${String(str).slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(from, to) {
  const a = parseDateOnly(from);
  const b = parseDateOnly(to);
  if (!a || !b) return null;
  return Math.ceil((b - a) / 86400000);
}

function defaultMeta() {
  return { settings: { warnDays: 7 }, entries: [], updatedAt: null };
}

async function loadMeta() {
  try {
    const raw = JSON.parse(await fs.promises.readFile(metaPath(), "utf8"));
    const entries = Array.isArray(raw?.entries) ? raw.entries : [];
    return {
      settings: {
        warnDays: Math.min(30, Math.max(1, parseInt(raw?.settings?.warnDays, 10) || 7)),
      },
      entries: entries
        .filter((e) => e && e.id)
        .map((e) => ({
          id: String(e.id),
          title: String(e.title || "").slice(0, 120),
          retailer: String(e.retailer || "").slice(0, 120),
          expiresAt: e.expiresAt ? String(e.expiresAt).slice(0, 10) : "",
          redeemedAt: e.redeemedAt ? String(e.redeemedAt).slice(0, 10) : "",
          expiryNotifiedAt: e.expiryNotifiedAt || null,
          warnNotifiedAt: e.warnNotifiedAt && typeof e.warnNotifiedAt === "object" ? e.warnNotifiedAt : {},
        })),
      updatedAt: raw?.updatedAt || null,
    };
  } catch (err) {
    if (err?.code === "ENOENT") return defaultMeta();
    return defaultMeta();
  }
}

async function saveMeta(meta) {
  const next = {
    settings: meta.settings || defaultMeta().settings,
    entries: (meta.entries || []).slice(0, 500),
    updatedAt: new Date().toISOString(),
  };
  await fs.promises.mkdir(path.dirname(metaPath()), { recursive: true });
  await fs.promises.writeFile(metaPath(), JSON.stringify(next, null, 2), "utf8");
  return next;
}

async function syncExpiryMeta(entries) {
  const prev = await loadMeta();
  const prevById = Object.fromEntries(prev.entries.map((e) => [e.id, e]));
  const nextEntries = (entries || [])
    .filter((e) => e && e.id && e.expiresAt && !e.redeemedAt)
    .map((e) => {
      const old = prevById[e.id] || {};
      return {
        id: e.id,
        title: e.title,
        retailer: e.retailer || "",
        expiresAt: String(e.expiresAt).slice(0, 10),
        redeemedAt: "",
        expiryNotifiedAt: old.expiryNotifiedAt || null,
        warnNotifiedAt: old.warnNotifiedAt || {},
      };
    });
  await saveMeta({ ...prev, entries: nextEntries });
}

function showNotification(title, body, meta = {}) {
  try {
    const { push } = require("./notifications-center");
    push({
      appId: "coupons",
      type: meta.type || "coupon-expiry",
      title: String(title || "Coupons"),
      body: String(body || ""),
      dedupeKey: meta.dedupeKey || null,
      route: meta.route || { action: "openEntry", param: meta.entryId || null },
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
  new Notification({ title, body }).show();
  return true;
}

async function checkExpiry() {
  const meta = await loadMeta();
  const warnDays = meta.settings.warnDays;
  const today = todayKey();
  const triggered = [];
  let dirty = false;

  for (const entry of meta.entries) {
    if (!entry.expiresAt || entry.redeemedAt) continue;
    const daysLeft = daysBetween(today, entry.expiresAt);
    if (daysLeft == null) continue;

    const label = entry.retailer ? `${entry.title} (${entry.retailer})` : entry.title;
    const route = { action: "openEntry", param: entry.id };

    if (daysLeft < 0) {
      if (!entry.expiryNotifiedAt) {
        showNotification("Coupon expired", `${label} expired on ${entry.expiresAt}`, {
          type: "coupon-expired",
          dedupeKey: `coupon-expired:${entry.id}`,
          route,
          entryId: entry.id,
        });
        entry.expiryNotifiedAt = new Date().toISOString();
        dirty = true;
        triggered.push({ id: entry.id, title: entry.title, type: "expired" });
      }
      continue;
    }

    const warnKey = `warn_${warnDays}`;
    if (daysLeft <= warnDays && daysLeft > 0 && !entry.warnNotifiedAt?.[warnKey]) {
      const fireKey = `${entry.id}:${warnKey}:${today}`;
      if (!firedThisMinute.has(fireKey)) {
        showNotification(
          "Coupon expiring soon",
          `${label} expires in ${daysLeft} day(s) (${entry.expiresAt})`,
          {
            type: "coupon-warning",
            dedupeKey: `coupon-warn:${entry.id}:${warnKey}`,
            route,
            entryId: entry.id,
          }
        );
        firedThisMinute.add(fireKey);
        entry.warnNotifiedAt = { ...(entry.warnNotifiedAt || {}), [warnKey]: today };
        dirty = true;
        triggered.push({ id: entry.id, title: entry.title, type: "warning", daysLeft });
      }
    }

    if (daysLeft === 0 && !entry.warnNotifiedAt?.expiry_today) {
      const fireKey = `${entry.id}:today:${today}`;
      if (!firedThisMinute.has(fireKey)) {
        showNotification("Coupon expires today", `${label} expires today`, {
          type: "coupon-today",
          dedupeKey: `coupon-today:${entry.id}:${today}`,
          route,
          entryId: entry.id,
        });
        firedThisMinute.add(fireKey);
        entry.warnNotifiedAt = { ...(entry.warnNotifiedAt || {}), expiry_today: today };
        dirty = true;
        triggered.push({ id: entry.id, title: entry.title, type: "today" });
      }
    }
  }

  if (dirty) await saveMeta(meta);
  return { ok: true, triggered, checkedAt: new Date().toISOString() };
}

function startCouponsExpiryService() {
  if (expiryTimer) return;
  checkExpiry().catch(() => {});
  expiryTimer = setInterval(() => {
    firedThisMinute.clear();
    checkExpiry().catch(() => {});
  }, 60 * 1000);
}

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

async function loadFile() {
  try {
    const raw = await fs.promises.readFile(storePath(), "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err?.code === "ENOENT") return null;
    throw err;
  }
}

async function saveFile(data) {
  await fs.promises.mkdir(path.dirname(storePath()), { recursive: true });
  await fs.promises.writeFile(storePath(), JSON.stringify(data, null, 2), "utf8");
}

function normalizeEntry(raw) {
  if (!raw || !String(raw.title || "").trim()) return null;
  const type = TYPES.includes(String(raw.type || "").toLowerCase())
    ? String(raw.type).toLowerCase()
    : "gift";
  const icons = { gift: "🎁", voucher: "🎟️", promo: "🏷️", membership: "💳" };
  return {
    id: String(raw.id || uid("cpn")),
    title: String(raw.title).trim().slice(0, 120),
    code: String(raw.code || "").trim(),
    pin: String(raw.pin || "").trim(),
    retailer: String(raw.retailer || "").trim().slice(0, 120),
    type,
    icon: String(raw.icon || icons[type] || "🎟️").trim().slice(0, 4) || icons[type],
    value: raw.value != null && raw.value !== "" ? String(raw.value).trim().slice(0, 40) : "",
    currency: String(raw.currency || "ILS").trim().slice(0, 8) || "ILS",
    url: String(raw.url || "").trim().slice(0, 500),
    notes: String(raw.notes || "").trim().slice(0, 2000),
    tags: Array.isArray(raw.tags) ? raw.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 12) : [],
    favorite: Boolean(raw.favorite),
    expiresAt: raw.expiresAt ? String(raw.expiresAt).slice(0, 32) : "",
    redeemedAt: raw.redeemedAt ? String(raw.redeemedAt).slice(0, 32) : "",
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

function requireSession() {
  if (!session?.key) throw new Error("Coupons wallet is locked");
  return session;
}

function maskCode(code) {
  const s = String(code || "").trim();
  if (!s) return "";
  if (s.length <= 4) return "••••";
  return `${"•".repeat(Math.min(8, s.length - 4))}${s.slice(-4)}`;
}

function publicEntry(e) {
  return {
    ...e,
    code: maskCode(e.code),
    pin: e.pin ? "••••" : "",
    hasCode: Boolean(e.code),
    hasPin: Boolean(e.pin),
    status: entryStatus(e),
  };
}

function entryStatus(e) {
  if (e.redeemedAt) return "redeemed";
  if (e.expiresAt) {
    const exp = new Date(e.expiresAt);
    if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) return "expired";
  }
  return "active";
}

function sortEntries(list) {
  return [...(list || [])].sort((a, b) => {
    const fa = a.favorite ? 0 : 1;
    const fb = b.favorite ? 0 : 1;
    if (fa !== fb) return fa - fb;
    return String(a.title || "").localeCompare(String(b.title || ""), undefined, {
      sensitivity: "base",
      numeric: true,
    });
  });
}

async function couponsStatus() {
  const file = await loadFile();
  return {
    ok: true,
    initialized: Boolean(file?.auth?.salt),
    unlocked: Boolean(session?.key),
    entryCount: session?.entries?.length ?? null,
  };
}

async function couponsUnlock(args) {
  let file = (await loadFile()) || {};
  const password = String(args?.password || "");
  if (!password) return { ok: false, error: "Password required" };

  if (!file?.auth?.salt) {
    file.auth = createAuthRecord(password);
    file.cipher = encryptJson(deriveKey(password, Buffer.from(file.auth.salt, "base64")), []);
    await saveFile(file);
  }

  const ok = verifyPassword(password, file.auth.salt, file.auth.hash);
  if (!ok) return { ok: false, error: "Wrong password" };

  const key = deriveKey(password, Buffer.from(file.auth.salt, "base64"));
  let entries = [];
  if (file.cipher) {
    try {
      entries = decryptJson(key, file.cipher);
    } catch {
      return { ok: false, error: "Wallet data corrupted" };
    }
  }

  session = { key, entries: entries.map(normalizeEntry).filter(Boolean), unlockedAt: Date.now() };
  await syncExpiryMeta(session.entries);
  checkExpiry().catch(() => {});
  return { ok: true, entries: sortEntries(session.entries).map(publicEntry) };
}

async function couponsLock() {
  session = null;
  return { ok: true };
}

async function persistEntries() {
  const s = requireSession();
  const file = (await loadFile()) || {};
  file.cipher = encryptJson(s.key, s.entries);
  await saveFile(file);
  await syncExpiryMeta(s.entries);
  checkExpiry().catch(() => {});
}

async function couponsList(args = {}) {
  const s = requireSession();
  const filter = String(args.filter || "all").toLowerCase();
  let list = sortEntries(s.entries);
  if (filter === "active") list = list.filter((e) => entryStatus(e) === "active");
  else if (filter === "redeemed" || filter === "used") list = list.filter((e) => entryStatus(e) === "redeemed");
  else if (filter === "expired") list = list.filter((e) => entryStatus(e) === "expired");
  return { ok: true, entries: list.map(publicEntry) };
}

async function couponsGet(args) {
  const s = requireSession();
  const entry = s.entries.find((e) => e.id === args?.id);
  if (!entry) return { ok: false, error: "Not found" };
  return { ok: true, entry: { ...entry, status: entryStatus(entry) } };
}

async function couponsSave(args) {
  const s = requireSession();
  const entry = normalizeEntry(args?.entry || args);
  if (!entry) return { ok: false, error: "Title required" };
  if (!entry.code && !entry.url) return { ok: false, error: "Code or URL required" };

  const idx = s.entries.findIndex((e) => e.id === entry.id);
  if (idx >= 0) {
    entry.createdAt = s.entries[idx].createdAt;
    if (!entry.code) entry.code = s.entries[idx].code;
    if (!entry.pin) entry.pin = s.entries[idx].pin;
    s.entries[idx] = entry;
  } else {
    s.entries.unshift(entry);
  }
  entry.updatedAt = new Date().toISOString();
  await persistEntries();
  return { ok: true, entry: publicEntry(entry) };
}

async function couponsDelete(args) {
  const s = requireSession();
  s.entries = s.entries.filter((e) => e.id !== args?.id);
  await persistEntries();
  return { ok: true };
}

async function couponsCopyCode(args) {
  const s = requireSession();
  const entry = s.entries.find((e) => e.id === args?.id);
  if (!entry?.code) return { ok: false, error: "No code" };
  clipboard.writeText(entry.code);
  return { ok: true };
}

async function couponsCopyPin(args) {
  const s = requireSession();
  const entry = s.entries.find((e) => e.id === args?.id);
  if (!entry?.pin) return { ok: false, error: "No PIN" };
  clipboard.writeText(entry.pin);
  return { ok: true };
}

async function couponsRedeem(args) {
  const s = requireSession();
  const entry = s.entries.find((e) => e.id === args?.id);
  if (!entry) return { ok: false, error: "Not found" };
  entry.redeemedAt = args?.redeemed === false ? "" : new Date().toISOString().slice(0, 10);
  entry.updatedAt = new Date().toISOString();
  await persistEntries();
  return { ok: true, entry: publicEntry(entry) };
}

async function handleCouponsInvoke(channel, args = {}) {
  const authErr = signedInGuard();
  if (authErr) return authErr;

  const ch = String(channel || "").trim();
  switch (ch) {
    case "coupons.status":
      return couponsStatus();
    case "coupons.unlock":
      return couponsUnlock(args);
    case "coupons.lock":
      return couponsLock();
    case "coupons.list":
      return couponsList(args);
    case "coupons.get":
      return couponsGet(args);
    case "coupons.save":
      return couponsSave(args);
    case "coupons.delete":
      return couponsDelete(args);
    case "coupons.copyCode":
      return couponsCopyCode(args);
    case "coupons.copyPin":
      return couponsCopyPin(args);
    case "coupons.redeem":
      return couponsRedeem(args);
    case "coupons.expiry.check":
      return checkExpiry();
    case "links.open": {
      const url = String(args?.url || "").trim();
      if (!url) return { ok: false, error: "Missing URL" };
      await shell.openExternal(url);
      return { ok: true };
    }
    case "clipboard.copy": {
      const text = String(args?.text ?? "");
      clipboard.writeText(text);
      return { ok: true };
    }
    default:
      return { ok: false, error: `Unknown Coupons channel: ${ch}` };
  }
}

module.exports = { handleCouponsInvoke, startCouponsExpiryService, checkExpiry };