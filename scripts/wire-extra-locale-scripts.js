const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const EXTRA = ["ar", "fr", "ru", "es"];

function insertAfter(html, afterNeedle, insertBlock) {
  if (html.includes(insertBlock.split("\n")[0])) return html;
  const idx = html.indexOf(afterNeedle);
  if (idx === -1) return html;
  const end = idx + afterNeedle.length;
  return html.slice(0, end) + "\n" + insertBlock + html.slice(end);
}

function patchHtml(file, relPrefix) {
  let html = fs.readFileSync(file, "utf8");
  const before = html;
  const langScript = `<script src="${relPrefix}i18n/languages.js"></script>`;
  if (!html.includes("i18n/languages.js") && html.includes(`${relPrefix}i18n/i18n.js`)) {
    html = html.replace(
      `<script src="${relPrefix}i18n/i18n.js"></script>`,
      `${langScript}\n    <script src="${relPrefix}i18n/i18n.js"></script>`
    );
  }

  const heTag = `<script src="${relPrefix}i18n/locales/he.js"></script>`;
  if (html.includes(heTag)) {
    const extras = EXTRA.map((l) => `<script src="${relPrefix}i18n/locales/${l}.js"></script>`).join("\n    ");
    for (const l of EXTRA) {
      if (!html.includes(`i18n/locales/${l}.js`)) {
        html = insertAfter(html, heTag, `    ${extras}`);
        break;
      }
    }
  }

  if (html !== before) {
    fs.writeFileSync(file, html);
    return true;
  }
  return false;
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "dist" || name === "build") continue;
      walk(p, out);
    } else if (name === "index.html" || name === "index.legacy.html") {
      out.push(p);
    }
  }
  return out;
}

let n = 0;
const shell = path.join(ROOT, "src", "index.html");
if (patchHtml(shell, "../apps/shared/")) {
  n++;
  console.log("shell");
}

for (const file of walk(path.join(ROOT, "apps"))) {
  const rel = file.includes(`${path.sep}shared${path.sep}`) ? null : "../shared/";
  if (!rel) continue;
  if (patchHtml(file, rel)) {
    n++;
    console.log(path.relative(ROOT, file));
  }
}

console.log("patched", n);