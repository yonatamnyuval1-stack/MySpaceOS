const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const bad = [];
const stripped = [];
const re = /^\s*(?:const|let|var)\s+.*=\s*require\s*\(|^\s*require\s*\(|^\s*import\s+/m;
const autoStripRe =
  /^\s*(?:const|let|var)\s*(?:\{[^}]*\}|\w+)\s*=\s*require\s*\(\s*["'](?:@composio\/core|lucide-static|electron\/main)["']\s*\)\s*;?\s*\r?\n/gm;

function rel(full) {
  return path.relative(ROOT, full).replace(/\\/g, "/");
}

function scanFile(full, { autoStrip = true, failOnRequire = true } = {}) {
  let text = fs.readFileSync(full, "utf8");
  const fileRel = rel(full);
  if (autoStrip && autoStripRe.test(text)) {
    text = text.replace(autoStripRe, "");
    text = text.replace(/^(?:\r?\n)+/, "");
    fs.writeFileSync(full, text, "utf8");
    stripped.push(fileRel);
  }
  if (!failOnRequire) return;
  const head = text.slice(0, 2000);
  if (re.test(head)) bad.push(fileRel);
}

function walkApps(dir) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name === "node_modules") continue;
      walkApps(full);
      continue;
    }
    if (!name.name.endsWith(".js")) continue;
    const base = name.name;
    const parent = path.basename(path.dirname(full));
    const isBrowserLikely =
      base === "app.js" ||
      parent === "lib" ||
      parent === "pages" ||
      parent === "scripts" ||
      parent === "shared";
    if (!isBrowserLikely) continue;
    scanFile(full, { autoStrip: true, failOnRequire: base === "app.js" || parent === "lib" || parent === "pages" });
  }
}

function walkSrc(dir) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name === "node_modules") continue;
      walkSrc(full);
      continue;
    }
    if (!name.name.endsWith(".js")) continue;
    scanFile(full, { autoStrip: true, failOnRequire: true });
  }
}
walkApps(path.join(ROOT, "apps"));
walkSrc(path.join(ROOT, "src"));
if (stripped.length) {
  console.warn("Auto-stripped accidental Node requires from:");
  for (const f of stripped) console.warn(" -", f);
}
if (bad.length) {
  console.error("Browser/renderer JS must not use require()/import (kills the UI):");
  for (const f of bad) console.error(" -", f);
  process.exit(1);
}
console.log("OK: no top-level require/import in src/ and browser app scripts");