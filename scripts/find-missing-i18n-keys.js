const fs = require("fs");
const path = require("path");
const en = require("../apps/shared/i18n/locales/en.js");

const files = [];
function walk(d) {
  for (const n of fs.readdirSync(d)) {
    const p = path.join(d, n);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (n === "node_modules" || n === ".git") continue;
      walk(p);
    } else if (n.endsWith(".js") || n.endsWith(".html")) files.push(p);
  }
}
walk(path.join(__dirname, "../src"));
for (const a of [
  "files",
  "jobs",
  "scheduler",
  "themes",
  "permissions",
  "pulse",
  "scripts",
  "updates",
  "network",
  "storage",
  "backup",
  "os-bridge",
  "resolve",
  "msl-protocol",
  "parts",
  "mail",
  "shell-console",
  "system-info",
]) {
  const d = path.join(__dirname, "../apps", a);
  if (fs.existsSync(d)) walk(d);
}

const used = new Set();
const reTt = /\btt\(\s*["']([a-zA-Z][a-zA-Z0-9._-]*)["']/g;
const reData = /data-i18n(?:-[a-z]+)?=["']([a-zA-Z][a-zA-Z0-9._-]*)["']/g;
for (const f of files) {
  const t = fs.readFileSync(f, "utf8");
  let m;
  while ((m = reTt.exec(t))) used.add(m[1]);
  while ((m = reData.exec(t))) used.add(m[1]);
}
const missing = [...used].filter((k) => en[k] == null).sort();
console.log("used", used.size, "missing", missing.length);
missing.forEach((k) => console.log(k));
