const { loadAppSettings } = require("../apps/app-settings-ipc");
const { CAPABILITIES: iconCaps } = require("./providers/icons");
const { CAPABILITIES: spaceCaps } = require("./providers/space");
const { CAPABILITIES: translateCaps } = require("./providers/translate");
const { CAPABILITIES: appsInfoCaps } = require("./providers/apps-info");
const { CAPABILITIES: clockCaps } = require("./providers/world-clock");
const { CAPABILITIES: stocksCaps } = require("./providers/stocks");
const { CAPABILITIES: historyCaps } = require("./providers/history");
const { CAPABILITIES: mapsCaps } = require("./providers/world-maps");
const { CAPABILITIES: contactsCaps } = require("./providers/contacts");
const { CAPABILITIES: notesCaps } = require("./providers/notes");
const { CAPABILITIES: geographyCaps } = require("./providers/geography");
const { CAPABILITIES: dayPlannerCaps } = require("./providers/day-planner");
const { CAPABILITIES: buildsCaps } = require("./providers/builds");
const { CAPABILITIES: studiesCaps } = require("./providers/studies");
const { CAPABILITIES: jobsCaps } = require("./providers/jobs");
const { CAPABILITIES: mindCaps } = require("./providers/mind");
const { CAPABILITIES: filesCaps } = require("./providers/files");
const registry = require("./registry");
const MslKey = require("../../apps/shared/msl-key");
const { reportRuntimeFailure } = require("../resolve/report-helper");

const CAPABILITIES = [
  ...iconCaps,
  ...spaceCaps,
  ...translateCaps,
  ...appsInfoCaps,
  ...clockCaps,
  ...stocksCaps,
  ...historyCaps,
  ...mapsCaps,
  ...contactsCaps,
  ...notesCaps,
  ...geographyCaps,
  ...dayPlannerCaps,
  ...buildsCaps,
  ...studiesCaps,
  ...jobsCaps,
  ...mindCaps,
  ...filesCaps,
];

const MSL_CLIENTS = new Set([
  "builds",
  "icon-library",
  "apps-info",
  "space",
  "translate",
  "studies",
  "day-planner",
  "shell-console",
  "contacts",
  "notes",
  "geography",
  "world-clock",
  "stocks",
  "history",
  "world-maps",
  "contracts",
  "profiles",
  "study-deck",
  "flag-quiz",
  "drift",
  "code-lexicon",
  "model-flow",
  "files",
  "desktop",
  "shell",
  "jobs",
  "mind",
  "msl-protocol",
]);

const PROVIDER_SETTINGS = {
  "icon-library": "icon-library",
  space: "space",
  translate: "translate",
  "apps-info": "apps-info",
  "world-clock": "world-clock",
  stocks: "stocks",
  history: "history",
  "world-maps": "world-maps",
  contacts: "contacts",
  notes: "notes",
  geography: "geography",
  "day-planner": "day-planner",
  builds: "builds",
  studies: "studies",
};

const ALLOWED_CALLERS = Object.fromEntries(
  CAPABILITIES.map((cap) => {
    if (cap.id.startsWith("icons.")) {
      return [
        cap.id,
        new Set([
          "builds",
          "icon-library",
          "apps-info",
          "day-planner",
          "contacts",
          "desktop",
          "shell",
          "studies",
        ]),
      ];
    }
    return [cap.id, MSL_CLIENTS];
  })
);

function findCapability(id) {
  return CAPABILITIES.find((c) => c.id === id) || null;
}

async function providerEnabled(providerId) {
  const settingsAppId = PROVIDER_SETTINGS[providerId];
  if (!settingsAppId) return true;

  try {
    const settings = await loadAppSettings(settingsAppId);
    return settings.mslProvider !== false;
  } catch {
    return true;
  }
}

async function callerMayUse(callerModuleId, capabilityId) {
  const allowed = ALLOWED_CALLERS[capabilityId];
  if (!allowed || !allowed.has(callerModuleId)) {
    return { ok: false, error: `Caller "${callerModuleId}" is not allowed to use ${capabilityId}` };
  }

  try {
    if (callerModuleId === "builds") {
      const settings = await loadAppSettings("builds");
      if (capabilityId.startsWith("icons.") && settings && settings.mslIcons === false) {
        return { ok: false, error: "MSL icons disabled in Builds settings (rollback)" };
      }
    }
  } catch {
  }

  const cap = findCapability(capabilityId);
  if (!cap) return { ok: false, error: `Unknown capability: ${capabilityId}` };

  try {
    if (!(await providerEnabled(cap.provider))) {
      return { ok: false, error: `Provider "${cap.provider}" disabled (rollback)` };
    }
  } catch {
  }

  return { ok: true, capability: cap };
}

async function listCapabilities(callerModuleId) {
  const out = [];
  for (const cap of CAPABILITIES) {
    const gate = await callerMayUse(callerModuleId, cap.id);
    if (!gate.ok) continue;
    out.push({
      id: cap.id,
      kind: cap.kind,
      provider: cap.provider,
      title: cap.title,
      description: cap.description,
    });
  }
  return { ok: true, capabilities: out };
}

async function invokeCapability(callerModuleId, args = {}) {
  const capabilityId = String(args.capability || args.id || "").trim();
  if (!capabilityId) return { ok: false, error: "Missing capability" };

  const gate = await callerMayUse(callerModuleId, capabilityId);
  if (!gate.ok) return gate;

  try {
    const result = await gate.capability.handler(args.input || {}, { caller: callerModuleId });
    return result && typeof result === "object" ? result : { ok: true, result };
  } catch (err) {
    reportRuntimeFailure("msl", "CAPABILITY_INVOKE_FAILED", err, {
      capabilityId,
      callerModuleId,
    });
    return { ok: false, error: err?.message || String(err) };
  }
}

async function handleMslInvoke(moduleId, channel, args = {}) {
  switch (channel) {
    case "msl.list":
      return listCapabilities(moduleId);
    case "msl.invoke":
      return invokeCapability(moduleId, args || {});
    case "msl.key.parse": {
      const parsed = MslKey.parse(args?.uri || args?.key || "");
      return parsed.ok ? { ok: true, ...parsed } : parsed;
    }
    case "msl.key.build": {
      try {
        const uri = MslKey.build(args?.capability, args?.input || {});
        return { ok: true, uri, ...MslKey.parse(uri) };
      } catch (err) {
        reportRuntimeFailure("msl", "KEY_BUILD_FAILED", err, {
          capability: args?.capability || "",
        });
        return { ok: false, error: err.message };
      }
    }
    case "msl.key.resolve": {
      const parsed = MslKey.parse(args?.uri || args?.key || "");
      if (!parsed.ok) return parsed;
      const result = await invokeCapability(moduleId, {
        capability: parsed.capability,
        input: parsed.input,
      });
      return { ok: result?.ok !== false, uri: parsed.uri, capability: parsed.capability, input: parsed.input, result };
    }
    case "msl.keys.list":
      return registry.listLibrary();
    case "msl.keys.save":
      return registry.saveKey(args || {});
    case "msl.keys.delete":
      return registry.deleteKey(args || {});
    case "msl.inject.list":
      return registry.listInjections(args || {});
    case "msl.inject.set":
      return registry.injectKey(args || {});
    case "msl.inject.remove":
      return registry.removeInjection(args || {});
    case "msl.inject.clear":
      return registry.clearInjections(args || {});
    case "msl.inject.targets":
      return { ok: true, targets: registry.INJECT_TARGETS };
    default:
      return { ok: false, error: `Unknown MSL channel: ${channel}` };
  }
}

module.exports = { handleMslInvoke, listCapabilities, invokeCapability };
