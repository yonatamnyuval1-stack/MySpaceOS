const fs = require("fs");
const path = require("path");

const appsDir = path.join(__dirname, "..", "apps");
const dirs = fs.readdirSync(appsDir).filter((d) => fs.existsSync(path.join(appsDir, d, "index.html")));
const runtimeTag = '    <script src="../shared/app-settings-runtime.js"></script>';

let count = 0;
for (const d of dirs) {
  const file = path.join(appsDir, d, "index.html");
  let html = fs.readFileSync(file, "utf8");
  if (html.includes("app-settings-runtime.js")) continue;
  if (!html.includes("settings-boot.js")) continue;
  html = html.replace(
    /<script src="\.\.\/shared\/settings-boot\.js"><\/script>/,
    `<script src="../shared/settings-boot.js"></script>\n${runtimeTag}`
  );
  fs.writeFileSync(file, html, "utf8");
  count += 1;
  console.log("patched", d);
}
console.log("total", count);
