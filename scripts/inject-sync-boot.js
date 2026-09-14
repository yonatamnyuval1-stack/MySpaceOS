const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "apps");
const apps = [
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
];

for (const id of apps) {
  const file = path.join(root, id, "index.html");
  if (!fs.existsSync(file)) continue;
  let html = fs.readFileSync(file, "utf8");
  if (html.includes("sync-boot.js")) {
    console.log("ok", id);
    continue;
  }
  if (!html.includes("shared/i18n/i18n.js")) {
    console.log("no i18n", id);
    continue;
  }
  html = html.replace(
    /<script src="\.\.\/shared\/i18n\/i18n\.js"><\/script>/,
    `<script src="../shared/i18n/i18n.js"></script>\n    <script src="../shared/i18n/sync-boot.js"></script>`
  );
  fs.writeFileSync(file, html);
  console.log("injected", id);
}