const fs = require("fs");
const path = require("path");

const APPS = path.join(__dirname, "..", "apps");
const CACHE = "20260825fix";

const SAFE_ATTACH = `let __attachThemesApi = null;
try {
  __attachThemesApi = require(path.join(__dirname, "..", "shared", "theme-preload")).attachThemesApi;
} catch (err) {
  console.error("[themes] preload helper failed:", err);
}
`;

function hardenPreload(file, appId) {
  let src = fs.readFileSync(file, "utf8");
  let changed = false;

  if (!/require\(["']path["']\)/.test(src)) {
    if (/require\(["']electron["']\)/.test(src)) {
      src = src.replace(
        /(const \{[^}]+\} = require\(["']electron["']\);?)/,
        `$1\nconst path = require("path");`
      );
      changed = true;
    }
  }

  if (/require\(path\.join\(__dirname,\s*"\.\.",\s*"shared",\s*"theme-preload"\)\)/.test(src)) {
    src = src.replace(
      /const \{ attachThemesApi \} = require\(path\.join\(__dirname,\s*"\.\.",\s*"shared",\s*"theme-preload"\)\);?\r?\n/,
      SAFE_ATTACH
    );
    changed = true;HTMLObjectElement
  }

  if (/attachThemesApi\s*\(/.test(src) && !/__attachThemesApi/.test(src)) {
    src = src.replace(/attachThemesApi\s*\(/g, "__attachThemesApi && __attachThemesApi(");
    changed = true;
  } else if (/__attachThemesApi/.test(src) && /attachThemesApi\s*\(/.test(src)) {
    src = src.replace(/(?<!__|let |var |const |function )attachThemesApi\s*\(/g, "__attachThemesApi && __attachThemesApi(");
    changed = true;
  }

  if (/__attachThemesApi = require/.test(src)) {
    src = src.replace(/\nattachThemesApi\s*\(/g, "\nif (__attachThemesApi) __attachThemesApi(");
    src = src.replace(/([^\w])attachThemesApi\s*\(/g, "$1__attachThemesApi && __attachThemesApi(");
    changed = true;
  }

  if (changed) fs.writeFileSync(file, src);
  return changed;
}

function bumpHtml(file) {
  let html = fs.readFileSync(file, "utf8");
  const next = html
    .replace(/theme-chrome\.css\?v=[^"]+/g, `theme-chrome.css?v=${CACHE}`)
    .replace(/theme-runtime\.js\?v=[^"']+/g, `theme-runtime.js?v=${CACHE}`);
  if (next !== html) {
    fs.writeFileSync(file, next);
    return true;
  }
  return false;
}

let preloads = 0;
let htmls = 0;
for (const name of fs.readdirSync(APPS)) {
  const dir = path.join(APPS, name);
  if (!fs.statSync(dir).isDirectory()) continue;
  const preload = path.join(dir, "preload.js");
  const html = path.join(dir, "index.html");
  if (fs.existsSync(preload) && /theme-preload|attachThemesApi/.test(fs.readFileSync(preload, "utf8"))) {
    if (hardenPreload(preload, name)) preloads++;
  }
  if (fs.existsSync(html) && /theme-chrome|theme-runtime/.test(fs.readFileSync(html, "utf8"))) {
    if (bumpHtml(html)) htmls++;
  }
}

console.log(JSON.stringify({ preloadsHardened: preloads, htmlsBumped: htmls, cache: CACHE }, null, 2));