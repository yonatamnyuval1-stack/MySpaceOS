const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const errors = [];

function checkElectronDist() {
  const dist = path.join(ROOT, "node_modules", "electron", "dist");
  if (!fs.existsSync(dist)) {
    errors.push("Electron dist missing — run: npm install electron");
    return;
  }
  for (const name of ["resources.pak", "chrome_100_percent.pak", "chrome_200_percent.pak"]) {
    const p = path.join(dist, name);
    if (!fs.existsSync(p) || fs.statSync(p).size < 1000) {
      errors.push(`Electron incomplete: missing/empty ${name} — reinstall electron`);
    }
  }
  const localesDir = path.join(dist, "locales");
  let localeCount = 0;
  if (fs.existsSync(localesDir)) {
    localeCount = fs.readdirSync(localesDir).filter((f) => f.endsWith(".pak")).length;
  }
  if (localeCount < 1) {
    errors.push("Electron locales empty — reinstall electron");
  } else {
    console.log(`OK: Electron dist (${localeCount} locales, resources.pak present)`);
  }
}

function walkSecrets(obj, trail, hits) {
  if (obj == null) return;
  if (typeof obj === "string") {
    const key = trail[trail.length - 1] || "";
    const looksSecret =
      /secret|apiKey|api_key|token|password|clientId|clientSecret|gemini/i.test(key) ||
      /^(sk-|lab_|AIza|ya29\.|ghp_)/i.test(obj);
    if (!looksSecret) return;
    const placeholder =
      !obj.trim() ||
      /^YOUR[_A-Z0-9.-]*$/i.test(obj) ||
      obj.includes("YOUR_") ||
      obj.includes("YOUR-") ||
      /YOUR_NAME|Path\\\\To|example\.com/i.test(obj);
    if (!placeholder) hits.push(`${trail.join(".")}=${obj.slice(0, 24)}…`);
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => walkSecrets(v, trail.concat(String(i)), hits));
    return;
  }
  if (typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) walkSecrets(v, trail.concat(k), hits);
  }
}

function checkExampleConfigs() {
  const configDir = path.join(ROOT, "config");
  const examples = fs
    .readdirSync(configDir)
    .filter((f) => f.endsWith(".example.json"))
    .map((f) => path.join(configDir, f));
  if (!examples.length) {
    errors.push("No config/*.example.json found");
    return;
  }
  for (const file of examples) {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (err) {
      errors.push(`${path.basename(file)}: invalid JSON (${err.message})`);
      continue;
    }
    const hits = [];
    walkSecrets(data, [], hits);
    if (hits.length) {
      errors.push(`${path.basename(file)} looks filled with real secrets: ${hits.join("; ")}`);
    }
  }
  console.log(`OK: ${examples.length} example config(s) are placeholders only`);
}

function checkMailOauthNotExample() {
  const real = path.join(ROOT, "config", "mail-oauth.json");
  const gitignore = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8");
  if (!/config\/mail-oauth\.json/.test(gitignore)) {
    errors.push("config/mail-oauth.json must stay in .gitignore");
  } else {
    console.log("OK: config/mail-oauth.json is gitignored");
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const files = pkg.build?.files || [];
  const positivelyIncludesReal = files.some(
    (f) => typeof f === "string" && f.replace(/\\/g, "/") === "config/mail-oauth.json"
  );
  if (positivelyIncludesReal) {
    errors.push("package.json build.files must not include config/mail-oauth.json");
  } else {
    console.log("OK: config/mail-oauth.json is not packaged (not in build.files allow-list)");
  }
  if (fs.existsSync(real)) {
    console.log("Note: local config/mail-oauth.json exists (dev only; gitignored, not packaged)");
  }
}

function checkNoPlaintextVaultPasswordInCode() {
  const target = path.join(ROOT, "main", "apps", "profiles-ipc.js");
  const src = fs.readFileSync(target, "utf8");
  if (/return cfg\?\.vault\?\.masterPassword|readConfigVaultPassword/.test(src)) {
    errors.push("profiles-ipc.js must not seed vault from plaintext vault.masterPassword");
  } else if (!/scrubLegacyPlaintextMasterPassword/.test(src)) {
    errors.push("profiles-ipc.js should scrub legacy vault.masterPassword from user-config");
  } else {
    console.log("OK: no plaintext vault.masterPassword seed path");
  }
}

function checkSmokeNotPackaged() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const files = pkg.build?.files || [];
  const blocksScripts = files.some((f) => typeof f === "string" && /(^|\/)!scripts\/\*\*/.test(f.replace(/\\/g, "/")));
  if (!blocksScripts) {
    errors.push('package.json build.files must include "!scripts/**" so smoke scripts are not packaged');
  } else {
    console.log("OK: scripts/** (including smoke-*) excluded from electron-builder");
  }
}

checkElectronDist();
checkExampleConfigs();
checkMailOauthNotExample();
checkNoPlaintextVaultPasswordInCode();
checkSmokeNotPackaged();
if (errors.length) {
  console.error("Release hygiene failed:");
  for (const e of errors) console.error(" -", e);
  process.exit(1);
}
console.log("OK: release hygiene checks passed");