const path = require("path");
const fs = require("fs");
const { app, Notification } = require("electron");
const { CONTRACT_TEMPLATES } = require(path.join(__dirname, "../../apps/contracts/lib/templates.js"));
const { fillTemplate, isClauseBodyEmpty } = require("../../shared/parts/tpl.mustache");
const {
  setupLocalAuthApp,
  requireSignedIn,
  registerSingleFileMigrator,
} = require("./local-auth-app-helper");

const APP_ID = "contracts";
const auth = setupLocalAuthApp(APP_ID);
registerSingleFileMigrator(APP_ID, "contracts.json");

const DATA_FILE = () => auth.userDataPath("data.json");

function signedInGuard() {
  return requireSignedIn(auth);
}

let expiryTimer = null;
const firedThisMinute = new Set();

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function getTemplate(id) {
  return CONTRACT_TEMPLATES.find((t) => t.id === id) || null;
}

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

function addMonthsISO(dateStr, months) {
  const d = parseDateOnly(dateStr) || new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function normalizeContract(raw) {
  if (!raw?.templateId || !getTemplate(raw.templateId)) return null;
  const tpl = getTemplate(raw.templateId);
  const fieldValues = {};
  for (const f of tpl.fields) {
    const v = raw.fieldValues?.[f.key];
    fieldValues[f.key] = v != null ? String(v) : String(f.default || "");
  }
  if (!fieldValues.effective_date) fieldValues.effective_date = todayKey();

  let expiryDate = String(raw.expiryDate || fieldValues.expiry_date || "").slice(0, 10);
  if (!expiryDate && tpl.defaultExpiryMonths > 0) {
    expiryDate = addMonthsISO(fieldValues.effective_date, tpl.defaultExpiryMonths);
  }
  fieldValues.expiry_date = expiryDate;

  const signatures = (Array.isArray(raw.signatures) ? raw.signatures : []).map((s) => ({
    slotId: String(s.slotId || ""),
    name: String(s.name || "").trim(),
    signedAt: s.signedAt || null,
    imageData: s.imageData || null,
  }));

  const requiredSlots = tpl.signatures.filter((s) => !s.optional);
  const allSigned = requiredSlots.every((slot) =>
    signatures.some((s) => s.slotId === slot.id && s.signedAt && s.imageData)
  );

  let status = String(raw.status || "draft");
  if (!["draft", "pending", "signed", "expired"].includes(status)) status = "draft";
  const exp = parseDateOnly(expiryDate);
  const today = parseDateOnly(todayKey());
  if (exp && today && exp < today) status = "expired";
  else if (allSigned && status !== "expired") status = "signed";
  else if (signatures.some((s) => s.signedAt) && status === "draft") status = "pending";

  return {
    id: raw.id && raw.id !== "null" ? String(raw.id) : uid("ctr"),
    templateId: raw.templateId,
    title: String(raw.title || tpl.title).trim() || tpl.title,
    fieldValues,
    expiryDate,
    status,
    signatures,
    expiryNotifiedAt: raw.expiryNotifiedAt || null,
    warnNotifiedAt: raw.warnNotifiedAt || {},
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function normalizeStorage(raw) {
  const contracts = (Array.isArray(raw?.contracts) ? raw.contracts : [])
    .map(normalizeContract)
    .filter(Boolean);
  return {
    contracts,
    settings: {
      warnDays: Math.min(30, Math.max(1, parseInt(raw?.settings?.warnDays, 10) || 7)),
    },
  };
}

async function loadStorage() {
  try {
    const raw = await fs.promises.readFile(DATA_FILE(), "utf8");
    return { ok: true, data: normalizeStorage(JSON.parse(raw)) };
  } catch (err) {
    if (err?.code === "ENOENT") return { ok: true, data: normalizeStorage({}) };
    return { ok: false, error: err.message };
  }
}

async function saveStorage(args) {
  const data = normalizeStorage(args?.data ?? args);
  await fs.promises.mkdir(path.dirname(DATA_FILE()), { recursive: true });
  await fs.promises.writeFile(DATA_FILE(), JSON.stringify(data, null, 2), "utf8");
  return { ok: true, data };
}

function showNotification(title, body, meta = {}) {
  try {
    const { push } = require("./notifications-center");
    push({
      appId: "contracts",
      type: meta.type || "contract-expiry",
      title: String(title || "Contracts"),
      body: String(body || ""),
      dedupeKey: meta.dedupeKey || null,
      route: meta.route || { page: "library" },
      priority: "high",
    });
    return;
  } catch {
  }
  try {
    const { allowNotify } = require("./focus-gate");
    if (!allowNotify()) return;
  } catch {
  }
  if (!Notification.isSupported()) return;
  new Notification({ title, body }).show();
}

function renderContractBody(contract) {
  const tpl = getTemplate(contract.templateId);
  if (!tpl) return { title: contract.title, clauses: [], documentKind: "contract" };
  const clauses = tpl.clauses
    .map((c) => ({
      n: c.n,
      title: c.title,
      body: fillTemplate(c.body, contract.fieldValues, { blankOptional: Boolean(c.optional) }),
      freeform: Boolean(c.freeform),
      optional: Boolean(c.optional),
    }))
    .filter((c) => !c.optional || !isClauseBodyEmpty(c.body));
  return {
    title: contract.title,
    templateTitle: tpl.title,
    category: tpl.category,
    documentKind: tpl.documentKind || "contract",
    clauses,
  };
}

async function checkExpiry() {
  const loaded = await loadStorage();
  if (!loaded.ok) return loaded;
  const { contracts, settings } = loaded.data;
  const warnDays = settings.warnDays;
  const triggered = [];
  let dirty = false;
  const today = todayKey();

  for (const c of contracts) {
    if (!c.expiryDate) continue;
    const daysLeft = daysBetween(today, c.expiryDate);
    if (daysLeft == null) continue;

    if (daysLeft < 0) {
      if (c.status !== "expired") {
        c.status = "expired";
        dirty = true;
      }
      if (!c.expiryNotifiedAt) {
        showNotification("Contract expired", `${c.title} expired on ${c.expiryDate}`, {
          type: "contract-expired",
          dedupeKey: `contract-expired:${c.id}`,
          route: { page: "document", contractId: c.id },
        });
        c.expiryNotifiedAt = new Date().toISOString();
        dirty = true;
        triggered.push({ id: c.id, title: c.title, type: "expired", expiryDate: c.expiryDate });
      }
      continue;
    }

    const warnKey = `warn_${warnDays}`;
    if (daysLeft <= warnDays && daysLeft > 0 && !c.warnNotifiedAt?.[warnKey]) {
      const fireKey = `${c.id}:${warnKey}:${today}`;
      if (!firedThisMinute.has(fireKey)) {
        showNotification("Contract expiring soon", `${c.title} expires in ${daysLeft} day(s) (${c.expiryDate})`, {
          type: "contract-warning",
          dedupeKey: `contract-warn:${c.id}:${warnKey}`,
          route: { page: "document", contractId: c.id },
        });
        firedThisMinute.add(fireKey);
        c.warnNotifiedAt = { ...(c.warnNotifiedAt || {}), [warnKey]: today };
        dirty = true;
        triggered.push({ id: c.id, title: c.title, type: "warning", daysLeft });
      }
    }

    if (daysLeft === 0 && !c.warnNotifiedAt?.expiry_today) {
      const fireKey = `${c.id}:today:${today}`;
      if (!firedThisMinute.has(fireKey)) {
        showNotification("Contract expires today", `${c.title} expires today`, {
          type: "contract-today",
          dedupeKey: `contract-today:${c.id}:${today}`,
          route: { page: "document", contractId: c.id },
        });
        firedThisMinute.add(fireKey);
        c.warnNotifiedAt = { ...(c.warnNotifiedAt || {}), expiry_today: today };
        dirty = true;
        triggered.push({ id: c.id, title: c.title, type: "today" });
      }
    }
  }

  if (dirty) await saveStorage({ data: { ...loaded.data, contracts } });
  return { ok: true, triggered, checkedAt: new Date().toISOString() };
}

async function getUpcoming() {
  const loaded = await loadStorage();
  if (!loaded.ok) return loaded;
  const today = todayKey();
  const upcoming = loaded.data.contracts
    .filter((c) => c.expiryDate && c.status !== "expired")
    .map((c) => ({
      id: c.id,
      title: c.title,
      expiryDate: c.expiryDate,
      status: c.status,
      daysLeft: daysBetween(today, c.expiryDate),
    }))
    .filter((c) => c.daysLeft != null && c.daysLeft <= 30)
    .sort((a, b) => a.daysLeft - b.daysLeft);
  return { ok: true, upcoming };
}

function startContractExpiryService() {
  if (expiryTimer) return;
  checkExpiry().catch(() => {});
  expiryTimer = setInterval(() => {
    firedThisMinute.clear();
    checkExpiry().catch(() => {});
  }, 60 * 1000);
}

const CHANNELS = {
  "templates.list": () => ({
    ok: true,
    templates: CONTRACT_TEMPLATES.map((t) => ({
      id: t.id,
      title: t.title,
      category: t.category,
      fieldCount: t.fields.length,
      defaultExpiryMonths: t.defaultExpiryMonths,
    })),
  }),
  "templates.get": (args) => {
    const tpl = getTemplate(args?.id);
    if (!tpl) return { ok: false, error: "Template not found" };
    return { ok: true, template: tpl };
  },
  "contracts.list": async () => {
    const loaded = await loadStorage();
    return { ok: true, contracts: loaded.data?.contracts || [] };
  },
  "contracts.get": async (args) => {
    const loaded = await loadStorage();
    const c = loaded.data?.contracts?.find((x) => x.id === args?.id);
    if (!c) return { ok: false, error: "Contract not found" };
    const tpl = getTemplate(c.templateId);
    return {
      ok: true,
      contract: c,
      template: tpl,
      rendered: renderContractBody(c),
    };
  },
  "contracts.save": async (args) => {
    const loaded = await loadStorage();
    const normalized = normalizeContract(args?.contract);
    if (!normalized) return { ok: false, error: "Invalid contract" };
    const list = loaded.data.contracts.filter((c) => c.id !== normalized.id);
    list.unshift(normalized);
    const saved = await saveStorage({ data: { ...loaded.data, contracts: list } });
    if (!saved.ok) return saved;
    return { ok: true, contract: normalized, data: saved.data };
  },
  "contracts.delete": async (args) => {
    const loaded = await loadStorage();
    const list = loaded.data.contracts.filter((c) => c.id !== args?.id);
    return saveStorage({ data: { ...loaded.data, contracts: list } });
  },
  "expiry.check": () => checkExpiry(),
  "expiry.upcoming": () => getUpcoming(),
};

async function handleContractsInvoke(channel, args) {
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

module.exports = { handleContractsInvoke, startContractExpiryService, renderContractBody, fillTemplate };
