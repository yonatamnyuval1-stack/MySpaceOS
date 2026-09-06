const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const { listAiTools, setAiToolActive, getAllToolDefs } = require("../ai/tools-registry");
const notifPrefs = require("./notifications-prefs");
const jobsEngine = require("../jobs/engine");
const composioStore = require("../composio/store");

const profile = require("../myspace-profile");

function platformPrefsPath() {
  try {
    return profile.profileScopedPath("permissions-platform.json");
  } catch {
    return path.join(__dirname, "..", "..", "config", "permissions-platform.json");
  }
}

function defaultPlatformPrefs() {
  return {
    version: 1,
    requireAiConfirm: true,
    allowUnattendedFlow: false,
    updatedAt: null,
  };
}

function loadPlatformPrefs() {
  try {
    const raw = JSON.parse(fs.readFileSync(platformPrefsPath(), "utf8"));
    return {
      ...defaultPlatformPrefs(),
      ...raw,
      requireAiConfirm: raw?.requireAiConfirm !== false,
      allowUnattendedFlow: raw?.allowUnattendedFlow === true,
    };
  } catch {
    return defaultPlatformPrefs();
  }
}

function savePlatformPrefs(patch = {}) {
  const next = {
    ...loadPlatformPrefs(),
    ...patch,
    version: 1,
    updatedAt: new Date().toISOString(),
  };
  if (typeof patch.requireAiConfirm === "boolean") next.requireAiConfirm = patch.requireAiConfirm;
  if (typeof patch.allowUnattendedFlow === "boolean") next.allowUnattendedFlow = patch.allowUnattendedFlow;
  fs.mkdirSync(path.dirname(platformPrefsPath()), { recursive: true });
  fs.writeFileSync(platformPrefsPath(), JSON.stringify(next, null, 2), "utf8");
  return { ok: true, prefs: next };
}

function getRequireAiConfirm() {
  return loadPlatformPrefs().requireAiConfirm !== false;
}

function loadBridgeState() {
  try {
    const file = path.join(app.getPath("userData"), "os-bridge.json");
    if (!fs.existsSync(file)) return { trustedDevices: {} };
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    return {
      trustedDevices:
        raw.trustedDevices && typeof raw.trustedDevices === "object" ? { ...raw.trustedDevices } : {},
    };
  } catch {
    return { trustedDevices: {} };
  }
}

function safeComposioSettings() {
  try {
    return composioStore.getSettings();
  } catch {
    return { enabled: true, allowlist: [], userId: "myspace-local" };
  }
}

function safeComposioHasKey() {
  try {
    return Boolean(composioStore.getApiKey());
  } catch {
    return false;
  }
}

function saveBridgeTrusted(trustedDevices) {
  const file = path.join(app.getPath("userData"), "os-bridge.json");
  let raw = {};
  try {
    if (fs.existsSync(file)) raw = JSON.parse(fs.readFileSync(file, "utf8")) || {};
  } catch {
    raw = {};
  }
  raw.trustedDevices = trustedDevices;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(raw, null, 2), "utf8");
}

function toolCategory(name) {
  const n = String(name || "");
  if (n.startsWith("shell_")) return "shell";
  if (n.startsWith("builds_")) return "builds";
  if (n.startsWith("drift_")) return "drift";
  if (n.startsWith("clock_")) return "clock";
  if (n.startsWith("stocks_")) return "stocks";
  if (n.startsWith("sysinfo_") || n.startsWith("system_")) return "system";
  return "other";
}

function overview() {
  const { CONFIRM_TOOLS } = require("../ai/action-confirm");
  const platform = loadPlatformPrefs();
  const tools = listAiTools();
  const toolList = tools.tools || [];
  const toolsOn = toolList.filter((t) => t.active).length;
  const toolsConfirm = toolList.filter((t) => CONFIRM_TOOLS.has(t.name)).length;
  const notif = notifPrefs.getPrefs()?.prefs || notifPrefs.getPrefs();
  const prefs = notif.prefs || notif;
  const capacityRes = jobsEngine.getCapacity();
  const cap = capacityRes?.capacity || {};
  const bridge = loadBridgeState();
  const devices = Object.entries(bridge.trustedDevices || {}).map(([id, v]) => ({
    id,
    name: v?.name || id,
    trusted: v?.trusted !== false,
  }));
  const composio = safeComposioSettings();

  return {
    ok: true,
    platform,
    summary: {
      toolsTotal: toolList.length,
      toolsEnabled: toolsOn,
      toolsDisabled: toolList.length - toolsOn,
      toolsNeedConfirm: toolsConfirm,
      mailAlerts: prefs.mailAlertsEnabled !== false,
      blockedSenders: (prefs.blockedSenders || []).length,
      allowShell: cap.allowShell !== false,
      allowScript: cap.allowScript !== false,
      allowLaunch: cap.allowLaunch !== false,
      allowProgram: cap.allowProgram !== false,
      trustedDevices: devices.filter((d) => d.trusted).length,
      composioEnabled: composio.enabled !== false,
      composioAllowlist: (composio.allowlist || []).length,
      requireAiConfirm: platform.requireAiConfirm !== false,
    },
  };
}

async function handlePermissionsInvoke(channel, args = {}) {
  const ch = String(channel || "").replace(/^permissions\./, "");

  switch (ch) {
    case "overview":
      return overview();

    case "platform.get":
      return { ok: true, prefs: loadPlatformPrefs() };

    case "platform.set":
      return savePlatformPrefs(args || {});

    case "tools.list": {
      const { CONFIRM_TOOLS } = require("../ai/action-confirm");
      const res = listAiTools();
      const tools = (res.tools || []).map((t) => ({
        ...t,
        category: toolCategory(t.name),
        needsConfirm: CONFIRM_TOOLS.has(t.name),
      }));
      return { ok: true, tools, categories: [...new Set(tools.map((t) => t.category))].sort() };
    }

    case "tools.set": {
      const name = args.name || args.tool;
      const active =
        typeof args.active === "boolean"
          ? args.active
          : typeof args.enabled === "boolean"
            ? args.enabled
            : true;
      return setAiToolActive(name, active);
    }

    case "tools.setMany": {
      const list = Array.isArray(args.tools) ? args.tools : [];
      const results = [];
      for (const item of list) {
        const active =
          typeof item.active === "boolean"
            ? item.active
            : typeof item.enabled === "boolean"
              ? item.enabled
              : true;
        results.push(setAiToolActive(item.name || item.tool, active));
      }
      return { ok: true, results, ...(await handlePermissionsInvoke("tools.list", {})) };
    }

    case "tools.enableAll": {
      for (const t of getAllToolDefs()) setAiToolActive(t.name, true);
      return handlePermissionsInvoke("tools.list", {});
    }

    case "tools.disableMutating": {
      const { CONFIRM_TOOLS } = require("../ai/action-confirm");
      for (const t of getAllToolDefs()) {
        if (CONFIRM_TOOLS.has(t.name)) setAiToolActive(t.name, false);
      }
      return handlePermissionsInvoke("tools.list", {});
    }

    case "notifications.get":
      return notifPrefs.getPrefs();

    case "notifications.set":
      return notifPrefs.setPrefs(args || {});

    case "notifications.block":
      return notifPrefs.addBlockedSender(args || {});

    case "notifications.unblock":
      return notifPrefs.removeBlockedSender(args || {});

    case "jobs.get":
      return jobsEngine.getCapacity();

    case "jobs.set": {
      const patch = {};
      for (const key of [
        "allowShell",
        "allowScript",
        "allowLaunch",
        "allowProgram",
        "allowDelay",
        "allowFileWrite",
        "allowHost",
        "allowAppBuild",
        "pauseWhenFocus",
        "notifyOnDone",
        "connectBoost",
      ]) {
        if (typeof args[key] === "boolean") patch[key] = args[key];
      }
      return jobsEngine.setCapacity(patch);
    }

    case "bridge.devices": {
      const bridge = loadBridgeState();
      const devices = Object.entries(bridge.trustedDevices || {}).map(([id, v]) => ({
        id,
        name: v?.name || "Phone",
        trusted: v?.trusted !== false,
        updatedAt: v?.updatedAt || null,
      }));
      return { ok: true, devices };
    }

    case "bridge.revoke": {
      const id = String(args.deviceId || args.id || "").trim();
      if (!id) return { ok: false, error: "deviceId required" };
      const bridge = loadBridgeState();
      delete bridge.trustedDevices[id];
      saveBridgeTrusted(bridge.trustedDevices);
      try {
        const { handleOsBridgeInvoke } = require("./os-bridge-ipc");
        await handleOsBridgeInvoke("devices.revoke", { deviceId: id });
      } catch {
      }
      return handlePermissionsInvoke("bridge.devices", {});
    }

    case "bridge.untrust": {
      const id = String(args.deviceId || args.id || "").trim();
      if (!id) return { ok: false, error: "deviceId required" };
      const bridge = loadBridgeState();
      if (bridge.trustedDevices[id]) {
        bridge.trustedDevices[id] = { ...bridge.trustedDevices[id], trusted: false };
        saveBridgeTrusted(bridge.trustedDevices);
      }
      return handlePermissionsInvoke("bridge.devices", {});
    }

    case "external.get": {
      const s = safeComposioSettings();
      return {
        ok: true,
        enabled: s.enabled !== false,
        allowlist: s.allowlist || [],
        userId: s.userId,
        hasKey: safeComposioHasKey(),
      };
    }

    case "external.set": {
      try {
        const patch = {};
        if (typeof args.enabled === "boolean") patch.enabled = args.enabled;
        if (Array.isArray(args.allowlist)) patch.allowlist = args.allowlist;
        const next = composioStore.saveSettings(patch);
        return {
          ok: true,
          enabled: next.enabled !== false,
          allowlist: next.allowlist || [],
        };
      } catch (err) {
        return { ok: false, error: err?.message || "Composio settings unavailable" };
      }
    }

    case "external.addAllow": {
      try {
        const slug = String(args.slug || args.toolkit || args.name || "")
          .trim()
          .toLowerCase();
        if (!slug) return { ok: false, error: "Toolkit slug required" };
        const s = composioStore.getSettings();
        const allowlist = [...new Set([...(s.allowlist || []), slug])];
        return handlePermissionsInvoke("external.set", { allowlist });
      } catch (err) {
        return { ok: false, error: err?.message || "Composio settings unavailable" };
      }
    }

    case "external.removeAllow": {
      try {
        const slug = String(args.slug || args.toolkit || args.name || "")
          .trim()
          .toLowerCase();
        const s = composioStore.getSettings();
        const allowlist = (s.allowlist || []).filter((x) => x !== slug);
        return handlePermissionsInvoke("external.set", { allowlist });
      } catch (err) {
        return { ok: false, error: err?.message || "Composio settings unavailable" };
      }
    }

    default:
      return { ok: false, error: `Unknown permissions channel: ${channel}` };
  }
}

module.exports = {
  handlePermissionsInvoke,
  loadPlatformPrefs,
  getRequireAiConfirm,
  savePlatformPrefs,
};
