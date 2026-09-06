const path = require("path");
const fs = require("fs");
const { app } = require("electron");
const { scanPorts } = require("./ports-scan");
const { scanProcesses } = require("./processes-scan");
const { scanMemory } = require("./memory-scan");
const { scanStorage } = require("./storage-scan");
const { scanCpu } = require("./cpu-scan");
const { scanSystem } = require("./system-scan");
const { scanNetwork } = require("./network-scan");
const { scanEnvironment } = require("./environment-scan");
const {
  scanDiskTree,
  scanDiskLargeFiles,
  listDiskRoots,
  requestCancelDiskScan,
} = require("./disk-scan");
const { sampleMetrics, getMetricsHistory, clearMetrics } = require("./metrics-store");

const CHANNELS = {
  "ports.scan": scanPorts,
  "processes.scan": scanProcesses,
  "memory.scan": scanMemory,
  "storage.scan": scanStorage,
  "cpu.scan": scanCpu,
  "system.scan": scanSystem,
  "network.scan": scanNetwork,
  "environment.scan": scanEnvironment,
  "disk.roots": listDiskRoots,
  "disk.scan": scanDiskTree,
  "disk.largeFiles": scanDiskLargeFiles,
  "disk.cancel": () => {
    requestCancelDiskScan();
    return { ok: true };
  },
  "metrics.sample": sampleMetrics,
  "metrics.history": getMetricsHistory,
  "metrics.clear": clearMetrics,
};

const { handleWorldClockInvoke } = require("./world-clock-ipc");
const { handleRemoteHubInvoke } = require("./remote-hub-ipc");
const { handleStudiesInvoke } = require("./studies-ipc");

const { handleProfilesInvoke } = require("./profiles-ipc");
const { handleStocksInvoke } = require("./stocks-ipc");
const { handleTranslateInvoke } = require("./translate-ipc");
const { handleContactsInvoke, startReminderService } = require("./contacts-ipc");
const { handleNotesInvoke } = require("./notes-ipc");
const { handleTasksInvoke } = require("./tasks-ipc");
const { handleChatInvoke } = require("./chat-ipc");
const { handleGeographyInvoke } = require("./geography-ipc");
const { handleHistoryInvoke } = require("./history-ipc");
const { handleSpaceInvoke } = require("./space-ipc");
const { handleContractsInvoke, startContractExpiryService } = require("./contracts-ipc");
const { handleBuildsInvoke } = require("./builds-ipc");
const { handleCodeLexiconInvoke } = require("./code-lexicon-ipc");
const { handleDriftInvoke } = require("./drift-ipc");
const { handleShellConsoleInvoke } = require("./shell-console-ipc");
const { handleScriptsInvoke } = require("./scripts-ipc");
const { handleWorldMapsInvoke } = require("./world-maps-ipc");
const { handleFlagQuizInvoke } = require("./flag-quiz-ipc");
const { handleStudyDeckInvoke } = require("./study-deck-ipc");
const { handleDayPlannerInvoke } = require("./day-planner-ipc");
const { handleAppsInfoInvoke } = require("./apps-info-ipc");
const { handleModelFlowInvoke } = require("./model-flow-ipc");
const { handlePiDigitsInvoke } = require("./pi-digits-ipc");
const { handleIconLibraryInvoke } = require("./icon-library-ipc");
const { handleDocsInvoke } = require("./docs-ipc");
const { handleMailInvoke } = require("../mail/mail-ipc");
const { handleOsBridgeInvoke } = require("./os-bridge-ipc");
const { handleCouponsInvoke } = require("./coupons-ipc");
const { handleFilesInvoke } = require("./files-ipc");
const { handlePartsInvoke } = require("../parts/broker");
const { handlePermissionsInvoke } = require("./permissions-ipc");
const { handleUserAppInvoke, isUserAppModule } = require("./user-app-ipc");
const {
  handleAppLocalAuthInvoke,
  hasLocalAuth,
  isLocalAuthChannel,
  resolveLoginEntryUrl,
} = require("./app-local-auth-ipc");

const ALLOWED_MODULES = new Set([
  "system-info",
  "world-clock",
  "remote-hub",
  "os-bridge",
  "files",
  "studies",
  "study-deck",
  "day-planner",
  "profiles",
  "stocks",
  "translate",
  "contacts",
  "notes",
  "tasks",
  "coupons",
  "chat",
  "geography",
  "history",
  "space",
  "contracts",
  "builds",
  "code-lexicon",
  "drift",
  "shell-console",
  "scripts",
  "world-maps",
  "flag-quiz",
  "apps-info",
  "model-flow",
  "pi-digits",
  "icon-library",
  "docs",
  "mail",
  "pulse",
  "parts",
  "permissions",
  "msl-protocol",
  "jobs",
  "resolve",
]);

function isAllowedModule(moduleId) {
  if (isUserAppModule(moduleId)) return true;
  if (!ALLOWED_MODULES.has(moduleId)) return false;
  const appDir = path.join(__dirname, "..", "..", "apps", moduleId);
  return fs.existsSync(appDir);
}

const { handleAppSettingsInvoke } = require("./app-settings-ipc");
const { handleMslInvoke } = require("../msl/broker");
const { handleLinkInvoke } = require("../link/broker");

async function handleMyAppInvoke(moduleId, channel, args, event) {
  if (!isAllowedModule(moduleId)) {
    return { ok: false, error: "Unknown app module" };
  }

  const ch = String(channel || "").trim();

  if (isLocalAuthChannel(ch)) {
    return handleAppLocalAuthInvoke(moduleId, ch, args, event);
  }

  if (ch.startsWith("settings.")) {
    return handleAppSettingsInvoke(moduleId, ch, args);
  }

  if (ch === "msl.list" || ch === "msl.invoke" || ch.startsWith("msl.")) {
    return handleMslInvoke(moduleId, ch, args || {});
  }

  if (ch === "link.routes.list" || ch.startsWith("link.")) {
    return handleLinkInvoke(moduleId, ch, args || {}, event);
  }

  if (moduleId === "system-info") {
    const handler = CHANNELS[ch];
    if (handler) return handler(args);
  }

  if (moduleId === "world-clock") {
    return handleWorldClockInvoke(ch, args);
  }

  if (moduleId === "remote-hub") {
    return handleRemoteHubInvoke(ch, args);
  }

  if (moduleId === "os-bridge") {
    return handleOsBridgeInvoke(ch, args);
  }

  if (moduleId === "files") {
    return handleFilesInvoke(ch, args);
  }

  if (moduleId === "studies") {
    return handleStudiesInvoke(ch, args);
  }

  if (moduleId === "profiles") {
    return handleProfilesInvoke(ch, args);
  }

  if (moduleId === "stocks") {
    return handleStocksInvoke(ch, args);
  }

  if (moduleId === "translate") {
    return handleTranslateInvoke(ch, args);
  }

  if (moduleId === "contacts") {
    return handleContactsInvoke(ch, args);
  }

  if (moduleId === "notes") {
    return handleNotesInvoke(ch, args);
  }

  if (moduleId === "tasks") {
    return handleTasksInvoke(ch, args);
  }

  if (moduleId === "coupons") {
    return handleCouponsInvoke(ch, args);
  }

  if (moduleId === "chat") {
    return handleChatInvoke(ch, args);
  }

  if (moduleId === "geography") {
    return handleGeographyInvoke(ch, args);
  }

  if (moduleId === "history") {
    return handleHistoryInvoke(ch, args);
  }

  if (moduleId === "space") {
    return handleSpaceInvoke(ch, args);
  }

  if (moduleId === "contracts") {
    return handleContractsInvoke(ch, args);
  }

  if (moduleId === "builds") {
    return handleBuildsInvoke(ch, args);
  }

  if (moduleId === "code-lexicon") {
    return handleCodeLexiconInvoke(ch, args);
  }

  if (moduleId === "drift") {
    return handleDriftInvoke(ch, args, event);
  }

  if (moduleId === "shell-console") {
    return handleShellConsoleInvoke(ch, args);
  }

  if (moduleId === "scripts") {
    return handleScriptsInvoke(ch, args);
  }

  if (moduleId === "world-maps") {
    return handleWorldMapsInvoke(ch, args, event);
  }

  if (moduleId === "flag-quiz") {
    return handleFlagQuizInvoke(ch, args);
  }

  if (moduleId === "study-deck") {
    return handleStudyDeckInvoke(ch, args);
  }

  if (moduleId === "day-planner") {
    return handleDayPlannerInvoke(ch, args);
  }

  if (moduleId === "apps-info") {
    return handleAppsInfoInvoke(ch, args);
  }

  if (moduleId === "model-flow") {
    return handleModelFlowInvoke(ch, args);
  }

  if (moduleId === "pi-digits") {
    return handlePiDigitsInvoke(ch, args);
  }

  if (moduleId === "icon-library") {
    return handleIconLibraryInvoke(ch, args);
  }

  if (moduleId === "docs") {
    return handleDocsInvoke(ch, args);
  }

  if (moduleId === "mail") {
    return handleMailInvoke(ch, args);
  }

  if (moduleId === "pulse") {
    if (ch.startsWith("link.")) {
      return handleLinkInvoke(moduleId, ch, args || {}, event);
    }
    return { ok: false, error: `Unknown pulse channel: ${ch}` };
  }

  if (moduleId === "parts") {
    if (ch.startsWith("parts.")) {
      return handlePartsInvoke(ch, args || {});
    }
    return { ok: false, error: `Unknown parts channel: ${ch}` };
  }

  if (moduleId === "permissions") {
    return handlePermissionsInvoke(ch, args || {});
  }

  if (isUserAppModule(moduleId)) {
    return handleUserAppInvoke(moduleId, ch, args || {});
  }

  return { ok: false, error: `Unknown channel: ${ch}` };
}

module.exports = { handleMyAppInvoke, isAllowedModule, startContractExpiryService };
