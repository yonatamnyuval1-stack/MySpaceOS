const { classify } = require("./classify");

const recent = new Map(); 
const DEDUPE_MS = 45_000;
const MAX_RECENT = 400;

const SKIP_APP_IDS = new Set(["resolve", "fault"]);
const SKIP_CHANNEL_PREFIXES = ["resolve.", "fault.", "link.register", "link.event.subscribe"];

let forwarding = false;

function fingerprint(appId, kind, message, source) {
  const msg = String(message || "")
    .replace(/\d{4,}/g, "#")
    .replace(/[0-9a-f]{8,}/gi, "#")
    .slice(0, 160);
  return `${appId}|${kind}|${source}|${msg}`;
}

function pruneRecent(now) {
  if (recent.size < MAX_RECENT) return;
  for (const [k, at] of recent) {
    if (now - at > DEDUPE_MS) recent.delete(k);
  }
  if (recent.size >= MAX_RECENT) {
    const oldest = [...recent.entries()].sort((a, b) => a[1] - b[1]).slice(0, 80);
    for (const [k] of oldest) recent.delete(k);
  }
}

function shouldSkipChannel(channel) {
  const ch = String(channel || "");
  return SKIP_CHANNEL_PREFIXES.some((p) => ch === p || ch.startsWith(p));
}

function appendPulse(fault) {
  try {
    const log = require("../link/log");
    log.append({
      kind: "fault",
      route: `${fault.appId}.${fault.kind || fault.code}`,
      caller: fault.caller || fault.source || "fault",
      ok: fault.severity !== "error",
      error: fault.severity === "error" || fault.severity === "warn" ? fault.message : "",
      meta: {
        source: fault.source,
        kind: fault.kind,
        category: fault.category,
        severity: fault.severity,
        noise: fault.noise,
      },
    });
  } catch {
  }
}

function forwardResolve(fault) {
  if (fault.noise && fault.severity === "info") return null;
  if (SKIP_APP_IDS.has(fault.appId)) return null;
  if (forwarding) return null;

  try {
    const { app } = require("electron");
    if (!app || !app.isReady?.()) {
      return null;
    }
  } catch {
    return null;
  }

  forwarding = true;
  try {
    const engine = require("../resolve/engine");
    return engine.report(
      {
        appId: fault.appId,
        code: fault.code,
        kind: fault.kind,
        message: fault.message,
        severity: fault.severity,
        category: fault.category,
        context: {
          ...(fault.context && typeof fault.context === "object" ? fault.context : {}),
          faultSource: fault.source,
          faultKind: fault.kind,
          channel: fault.channel || undefined,
          stack: fault.stack ? String(fault.stack).slice(0, 2000) : undefined,
        },
        caller: fault.caller || `fault:${fault.source}`,
        dedupe: true,
      },
      fault.caller || "fault"
    );
  } catch (err) {
    console.error("[fault] resolve forward failed:", err?.message || err);
    return null;
  } finally {
    forwarding = false;
  }
}

function observe(raw = {}) {
  try {
    const source = String(raw.source || "manual").trim();
    const channel = raw.channel ? String(raw.channel) : "";
    if (shouldSkipChannel(channel)) {
      return { ok: true, skipped: true, reason: "channel" };
    }

    let appId = String(raw.appId || raw.app || raw.moduleId || "").trim() || "system";
    if (SKIP_APP_IDS.has(appId) && source !== "manual") {
      return { ok: true, skipped: true, reason: "app" };
    }

    const classified = classify(raw);
    const fault = {
      appId,
      kind: classified.kind,
      code: classified.code,
      message: classified.message,
      category: classified.category,
      severity: classified.severity,
      noise: classified.noise,
      alert: classified.alert,
      title: classified.title,
      source,
      channel: channel || undefined,
      caller: raw.caller ? String(raw.caller) : undefined,
      stack: raw.stack || raw.err?.stack || undefined,
      context: raw.context && typeof raw.context === "object" ? raw.context : {},
      at: new Date().toISOString(),
    };

    const now = Date.now();
    const fp = fingerprint(fault.appId, fault.kind, fault.message, fault.source);
    const last = recent.get(fp);
    if (last && now - last < DEDUPE_MS) {
      return { ok: true, observed: true, deduped: true, fault };
    }
    recent.set(fp, now);
    pruneRecent(now);

    appendPulse(fault);

    let resolveResult = null;
    if (!fault.noise || fault.severity === "warn" || fault.severity === "error") {
      if (fault.severity !== "info") {
        resolveResult = forwardResolve(fault);
      }
    }

    if (fault.severity === "error" && !fault.noise) {
      console.error(`[fault] ${fault.appId}.${fault.kind}: ${fault.message}`);
    }

    return {
      ok: true,
      observed: true,
      fault,
      resolve: resolveResult || undefined,
    };
  } catch (err) {
    console.error("[fault] observe failed:", err?.message || err);
    return { ok: false, error: err?.message || String(err) };
  }
}

function observeError(appId, err, extra = {}) {
  const e = err instanceof Error ? err : new Error(String(err || "Error"));
  return observe({
    appId: appId || "system",
    message: e.message,
    stack: e.stack,
    ...extra,
  });
}

module.exports = {
  observe,
  observeError,
  fingerprint,
};