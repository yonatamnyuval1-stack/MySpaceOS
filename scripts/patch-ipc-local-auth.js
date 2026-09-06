const fs = require("fs");
const path = require("path");

const IPC_DIR = path.join(__dirname, "..", "main", "apps");

/** @type {Record<string, { legacy: string|string[], main?: string, handler: string, multi?: boolean }>} */
const APP_IPC = {
  tasks: { legacy: "tasks.json", handler: "handleTasksInvokeUnlocked" },
  contacts: { legacy: "contacts.json", handler: "handleContactsInvoke" },
  "day-planner": { legacy: "day-planner.json", handler: "handleDayPlannerInvoke" },
  "study-deck": { legacy: "study-deck.json", handler: "handleStudyDeckInvoke" },
  stocks: { legacy: "stocks.json", handler: "handleStocksInvoke" },
  translate: { legacy: "translate.json", handler: "handleTranslateInvoke" },
  studies: { legacy: "studies.json", handler: "handleStudiesInvoke" },
  "world-clock": { legacy: "world-clock.json", handler: "handleWorldClockInvoke" },
  "remote-hub": { legacy: "remote-hub.json", handler: "handleRemoteHubInvoke" },
  docs: { legacy: "docs.json", handler: "handleDocsInvoke" },
  contracts: { legacy: "contracts.json", handler: "handleContractsInvoke" },
  builds: { legacy: "builds.json", handler: "handleBuildsInvoke" },
  "code-lexicon": { legacy: "code-lexicon.json", handler: "handleCodeLexiconInvoke" },
  drift: { legacy: "drift.json", handler: "handleDriftInvoke" },
  "flag-quiz": { legacy: "flag-quiz-scores.json", handler: "handleFlagQuizInvoke" },
  "pi-digits": { legacy: "pi-digits.json", handler: "handlePiDigitsInvoke" },
  "icon-library": { legacy: "icon-library.json", handler: "handleIconLibraryInvoke" },
  geography: {
    legacy: ["geography.json", "geography-countries-cache.json"],
    multi: true,
    handler: "handleGeographyInvoke",
  },
  history: {
    legacy: ["history.json", "history-cache.json"],
    multi: true,
    handler: "handleHistoryInvoke",
  },
  space: {
    legacy: ["space.json", "space-apod-cache.json"],
    multi: true,
    handler: "handleSpaceInvoke",
  },
  coupons: {
    legacy: ["coupons-vault.json", "coupons-expiry-meta.json"],
    multi: true,
    handler: "handleCouponsInvoke",
  },
};

function authHeader(appId, cfg) {
  const legacyExpr = cfg.multi
    ? `[${cfg.legacy.map((f) => JSON.stringify(f)).join(", ")}]`
    : JSON.stringify(cfg.legacy);

  const dataFileBlock = cfg.multi
    ? cfg.legacy
        .map((f) => {
          const varName = f.replace(/[^a-z0-9]/gi, "_").toUpperCase();
          return `const ${varName}_FILE = () => auth.userDataPath(${JSON.stringify(f)});`;
        })
        .join("\n")
    : `const DATA_FILE = () => auth.userDataPath("data.json");`;

  const migratorCall = cfg.multi
    ? `registerLegacyMigrator(APP_ID, ${legacyExpr});`
    : `registerSingleFileMigrator(APP_ID, ${legacyExpr});`;

  return `const {
  setupLocalAuthApp,
  requireSignedIn,
  userStorageRoot,
  registerLegacyMigrator,
  registerSingleFileMigrator,
} = require("./local-auth-app-helper");

const APP_ID = ${JSON.stringify(appId)};
const auth = setupLocalAuthApp(APP_ID);
${migratorCall}

${dataFileBlock}

function signedInGuard() {
  return requireSignedIn(auth);
}
`;
}

function patchIpc(appId, cfg) {
  const file = path.join(IPC_DIR, `${appId}-ipc.js`);
  if (!fs.existsSync(file)) {
    console.warn("missing ipc:", file);
    return false;
  }
  let src = fs.readFileSync(file, "utf8");
  if (src.includes("setupLocalAuthApp") || src.includes("local-auth-app-helper")) {
    console.log("skip (already patched):", appId);
    return false;
  }

  src = src.replace(
    /^const DATA_FILE = \(\) => path\.join\(app\.getPath\("userData"\), [^)]+\);\n/m,
    ""
  );
  src = src.replace(
    /^const USER_FILE = \(\) => path\.join\(app\.getPath\("userData"\), [^)]+\);\n/m,
    ""
  );
  src = src.replace(
    /^const CACHE_FILE = \(\) => path\.join\(app\.getPath\("userData"\), [^)]+\);\n/m,
    ""
  );
  src = src.replace(
    /^function dataFile\(\) \{\n  return path\.join\(app\.getPath\("userData"\), [^}]+\}\n/m,
    ""
  );
  src = src.replace(
    /^function DATA_FILE\(\) \{\n  return path\.join\(app\.getPath\("userData"\), [^}]+\}\n/m,
    ""
  );

  const insertAt = src.search(/\n\n(?:const|let|function|async function)/);
  if (insertAt < 0) {
    console.warn("could not find insert point:", appId);
    return false;
  }
  src = src.slice(0, insertAt) + "\n\n" + authHeader(appId, cfg) + src.slice(insertAt);

  if (cfg.multi) {
    for (const f of cfg.legacy) {
      const varName = f.replace(/[^a-z0-9]/gi, "_").toUpperCase();
      src = src.replace(new RegExp(`USER_FILE\\(\\)`, "g"), `${varName}_FILE()`);
      src = src.replace(new RegExp(`CACHE_FILE\\(\\)`, "g"), `${varName}_FILE()`);
      if (f.includes("geography.json")) {
        src = src.replace(/USER_FILE\(\)/g, `${varName}_FILE()`);
      }
    }
    if (appId === "geography") {
      src = src.replace(/USER_FILE\(\)/g, "GEOGRAPHY_JSON_FILE()");
      src = src.replace(/CACHE_FILE\(\)/g, "GEOGRAPHY_COUNTRIES_CACHE_JSON_FILE()");
    }
    if (appId === "history") {
      src = src.replace(/USER_FILE\(\)/g, "HISTORY_JSON_FILE()");
      src = src.replace(/CACHE_FILE\(\)/g, "HISTORY_CACHE_JSON_FILE()");
    }
    if (appId === "space") {
      src = src.replace(/USER_FILE\(\)/g, "SPACE_JSON_FILE()");
      src = src.replace(/APOD_CACHE_FILE\(\)/g, "SPACE_APOD_CACHE_JSON_FILE()");
    }
    if (appId === "coupons") {
      src = src.replace(/vaultFile\(\)/g, "COUPONS_VAULT_JSON_FILE()");
      src = src.replace(/metaFile\(\)/g, "COUPONS_EXPIRY_META_JSON_FILE()");
    }
  }

  const handlerPattern = new RegExp(
    `(async function ${cfg.handler}\\([^)]*\\)\\s*\\{\\s*\\n)(\\s*const ch =|\\s*return withLock)`,
    "m"
  );
  if (handlerPattern.test(src)) {
    src = src.replace(
      handlerPattern,
      `$1  const authErr = signedInGuard();\n  if (authErr) return authErr;\n\n$2`
    );
  } else {
    const alt = new RegExp(`(async function ${cfg.handler}\\([^)]*\\)\\s*\\{)`, "m");
    if (alt.test(src)) {
      src = src.replace(alt, `$1\n  const authErr = signedInGuard();\n  if (authErr) return authErr;`);
    } else {
      console.warn("handler guard not inserted:", appId, cfg.handler);
    }
  }

  if (appId === "geography") {
    src = src.replace(/app\.getPath\("userData"\)/g, "userStorageRoot(auth)");
  }

  fs.writeFileSync(file, src, "utf8");
  console.log("patched ipc:", appId);
  return true;
}

let n = 0;
for (const [appId, cfg] of Object.entries(APP_IPC)) {
  if (patchIpc(appId, cfg)) n += 1;
}
console.log(`Patched ${n} IPC files`);
