const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const { loadJsonFile, dataFileForApp } = require("../apps/safe-json-store");

async function recoverJsonFile(file) {
  const name = String(file || "").trim();
  if (!name || name.includes("..") || name.includes("/") || name.includes("\\")) {
    return { ok: false, error: "Invalid data file" };
  }
  const profile = require("../myspace-profile");
  const filePath = profile.profileScopedPath(name);
  const bakPath = `${filePath}.bak`;
  if (!fs.existsSync(bakPath)) {
    return { ok: false, error: `No backup found (${name}.bak)` };
  }
  const bakLoaded = loadJsonFile(bakPath, { fallback: null });
  if (!bakLoaded.ok) {
    return { ok: false, error: bakLoaded.error || "Backup file is corrupt" };
  }
  fs.copyFileSync(bakPath, filePath);
  return {
    ok: true,
    message: `Restored ${name} from backup`,
    file: name,
    recovered: Boolean(bakLoaded.recovered),
  };
}

async function runStep(step, incident) {
  const action = String(step?.action || "").trim();
  const args = step?.args && typeof step.args === "object" ? step.args : {};

  if (action === "safe-json.recover") {
    return recoverJsonFile(args.file);
  }

  if (action === "safe-json.recover-for-app") {
    const appId = String(args.appId || incident?.appId || "").trim();
    const file = String(args.file || dataFileForApp(appId) || "").trim();
    if (!file) {
      return { ok: false, error: `No known data file for app "${appId}"` };
    }
    return recoverJsonFile(file);
  }

  if (action === "advise") {
    return {
      ok: true,
      message: String(args.message || step?.label || "See guidance"),
      advisory: true,
    };
  }

  return { ok: false, error: `Unknown action: ${action || "(empty)"}` };
}

module.exports = { runStep };