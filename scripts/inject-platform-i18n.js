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

const block = [
  '<script src="../shared/i18n/locales/en.js"></script>',
  '<script src="../shared/i18n/locales/he.js"></script>',
  '<script src="../shared/i18n/i18n.js"></script>',
  '<script src="../shared/i18n/auto-mark.js"></script>',
  '<script src="../shared/i18n/boot-service.js"></script>',
].join("\n    ");

for (const id of apps) {
  const file = path.join(root, id, "index.html");
  if (!fs.existsSync(file)) {
    console.log("skip missing", id);
    continue;
  }
  let html = fs.readFileSync(file, "utf8");
  if (html.includes("auto-mark.js")) {
    console.log("ok already", id);
    continue;
  }
  if (html.includes("shared/i18n/boot-service.js")) {
    html = html.replace(
      /<script src="\.\.\/shared\/i18n\/i18n\.js"><\/script>\s*\n\s*<script src="\.\.\/shared\/i18n\/boot-service\.js"><\/script>/,
      `<script src="../shared/i18n/i18n.js"></script>\n    <script src="../shared/i18n/auto-mark.js"></script>\n    <script src="../shared/i18n/boot-service.js"></script>`
    );
    fs.writeFileSync(file, html);
    console.log("inserted auto-mark", id);
    continue;
  }
  if (html.includes("</body>")) {
    html = html.replace("</body>", `    ${block}\n  </body>`);
    fs.writeFileSync(file, html);
    console.log("injected full block", id);
  } else {
    console.log("no body", id);
  }
}