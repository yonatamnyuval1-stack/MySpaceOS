const fs = require("fs");
const path = require("path");

function projectConfigPath() {
  return path.join(__dirname, "..", "..", "config", "mail-oauth.json");
}

function userConfigPath() {
  try {
    const profile = require("../myspace-profile");
    return profile.installWidePath("mail-oauth.json");
  } catch {
    return null;
  }
}

function configPaths() {
  const paths = [];
  const userPath = userConfigPath();
  if (userPath) paths.push(userPath);
  paths.push(projectConfigPath());
  return paths;
}

function configPath() {
  for (const p of configPaths()) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
    }
  }
  return projectConfigPath();
}

function readFileConfig() {
  for (const p of configPaths()) {
    try {
      return JSON.parse(fs.readFileSync(p, "utf8"));
    } catch (err) {
      if (err && err.code !== "ENOENT") continue;
    }
  }
  return {};
}

function configStatus() {
  const configured = isProviderConfigured("gmail");
  const activePath = configPath();
  const exists = (() => {
    try {
      return fs.existsSync(activePath);
    } catch {
      return false;
    }
  })();
  return {
    configured,
    path: activePath,
    exists,
    hint: configured
      ? null
      : "Copy config/mail-oauth.example.json → config/mail-oauth.json (or place mail-oauth.json in your My Space data folder) and add Google OAuth credentials.",
  };
}

function providerConfig(providerId) {
  const file = readFileConfig();
  const fromFile = file?.[providerId] || {};
  const prefix = String(providerId || "").toUpperCase().replace(/-/g, "_");

  const clientId =
    String(process.env[`MYSPACE_${prefix}_CLIENT_ID`] || fromFile.clientId || "").trim() || null;
  const clientSecret =
    String(process.env[`MYSPACE_${prefix}_CLIENT_SECRET`] || fromFile.clientSecret || "").trim() ||
    null;

  return { clientId, clientSecret, redirectPort: fromFile.redirectPort || null };
}

function isProviderConfigured(providerId) {
  const cfg = providerConfig(providerId);
  return Boolean(cfg.clientId && cfg.clientSecret);
}
module.exports = { providerConfig, isProviderConfigured, configPath, configStatus, configPaths };