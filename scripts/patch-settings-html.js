const fs = require("fs");
const path = require("path");

const appsDir = path.join(__dirname, "..", "apps");
const dirs = fs.readdirSync(appsDir).filter((d) => fs.existsSync(path.join(appsDir, d, "index.html")));
const cssLink = '    <link rel="stylesheet" href="../shared/settings-panel.css" />';
const scripts = `    <script src="../shared/settings-definitions.js"></script>
    <script src="../shared/settings-boot.js"></script>`;

let count = 0;
for (const d of dirs) {
  const file = path.join(appsDir, d, "index.html");
  let html = fs.readFileSync(file, "utf8");
  if (html.includes("settings-panel.css")) continue;
  html = html.replace(
    /<link rel="stylesheet" href="styles\.css" \/>/,
    (m) => `${m}\n${cssLink}`
  );
  html = html.replace(
    /<script src="app\.js"><\/script>/,
    `${scripts}\n    <script src="app.js"></script>`
  );
  fs.writeFileSync(file, html, "utf8");
  count += 1;
  console.log("patched", d);
}
console.log("total", count);
