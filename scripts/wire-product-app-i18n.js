const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const APPS = path.join(ROOT, "apps");
const PRODUCT = [
  "builds",
  "chat",
  "code-lexicon",
  "contacts",
  "contracts",
  "coupons",
  "day-planner",
  "docs",
  "drift",
  "flag-quiz",
  "geography",
  "history",
  "icon-library",
  "notes",
  "pi-digits",
  "profiles",
  "remote-hub",
  "space",
  "stocks",
  "studies",
  "study-deck",
  "tasks",
  "translate",
  "world-clock",
  "world-maps",
];

const I18N_BLOCK = [
  '<script src="../shared/i18n/locales/en.js"></script>',
  '<script src="../shared/i18n/locales/he.js"></script>',
  '<script src="../shared/i18n/i18n.js"></script>',
  '<script src="../shared/i18n/app-language.js"></script>',
].join("\n    ");

const SETTINGS_BLOCK = [
  '<script src="../shared/settings-definitions.js"></script>',
  '<script src="../shared/settings-boot.js"></script>',
  '<script src="../shared/app-settings-runtime.js"></script>',
].join("\n    ");

const BOOT_LINE = '<script>window.MySpaceAppLanguage && window.MySpaceAppLanguage.boot();</script>';

const PRELOAD_SNIPPET = `
try {
  const { attachOsI18n } = require("../shared/i18n/preload-bridge");
  attachOsI18n(contextBridge, ipcRenderer);
} catch (err) {
  console.error("[preload] i18n bridge failed:", err);
}
`;

function ensureCss(html) {
  if (html.includes("settings-panel.css")) return html;
  if (html.includes("theme-chrome.css")) {
    return html.replace(
      /(<link[^>]*theme-chrome\.css[^>]*>)/,
      `$1\n    <link rel="stylesheet" href="../shared/settings-panel.css" />`
    );
  }
  return html.replace(
    /<\/head>/i,
    `    <link rel="stylesheet" href="../shared/settings-panel.css" />\n  </head>`
  );
}

function ensureScripts(html) {
  let out = html;
  if (!out.includes("shared/i18n/locales/en.js")) {
    if (out.includes("settings-definitions.js")) {
      out = out.replace(
        /<script src="\.\.\/shared\/settings-definitions\.js"><\/script>/,
        `${I18N_BLOCK}\n    <script src="../shared/settings-definitions.js"></script>`
      );
    } else if (/<script src="app\.js[^"]*"><\/script>/.test(out)) {
      out = out.replace(
        /<script src="app\.js[^"]*"><\/script>/,
        `${I18N_BLOCK}\n    ${SETTINGS_BLOCK}\n    <script src="app.js"></script>`
      );
      const m = html.match(/<script src="(app\.js[^"]*)"><\/script>/);
      if (m && m[1] !== "app.js") {
        out = out.replace('<script src="app.js"></script>', `<script src="${m[1]}"></script>`);
      }
    } else {
      out = out.replace(
        /<\/body>/i,
        `    ${I18N_BLOCK}\n    ${SETTINGS_BLOCK}\n    ${BOOT_LINE}\n  </body>`
      );
      return out;
    }
  } else if (!out.includes("app-language.js")) {
    out = out.replace(
      /<script src="\.\.\/shared\/i18n\/i18n\.js"><\/script>/,
      `<script src="../shared/i18n/i18n.js"></script>\n    <script src="../shared/i18n/app-language.js"></script>`
    );
  }

  if (!out.includes("settings-definitions.js")) {
    if (/<script src="app\.js[^"]*"><\/script>/.test(out)) {
      out = out.replace(
        /(<script src="app\.js[^"]*"><\/script>)/,
        `${SETTINGS_BLOCK}\n    $1`
      );
    } else {
      out = out.replace(/<\/body>/i, `    ${SETTINGS_BLOCK}\n  </body>`);
    }
  }

  if (!out.includes("MySpaceAppLanguage") || !out.includes("MySpaceAppLanguage.boot")) {
    if (/<script src="app\.js[^"]*"><\/script>/.test(out)) {
      out = out.replace(
        /(<script src="app\.js[^"]*"><\/script>)/,
        `$1\n    ${BOOT_LINE}`
      );
    } else if (!out.includes(BOOT_LINE)) {
      out = out.replace(/<\/body>/i, `    ${BOOT_LINE}\n  </body>`);
    }
  }

  return out;
}

function ensurePreload(file) {
  if (!fs.existsSync(file)) return false;
  let src = fs.readFileSync(file, "utf8");
  if (src.includes("attachOsI18n")) return false;
  if (!src.includes("contextBridge") || !src.includes("ipcRenderer")) return false;
  src = src.trimEnd() + "\n" + PRELOAD_SNIPPET;
  fs.writeFileSync(file, src.endsWith("\n") ? src : src + "\n");
  return true;
}

let htmlCount = 0;
let preloadCount = 0;

for (const id of PRODUCT) {
  const dir = path.join(APPS, id);
  const htmlPath = path.join(dir, "index.html");
  if (fs.existsSync(htmlPath)) {
    let html = fs.readFileSync(htmlPath, "utf8");
    const before = html;
    html = ensureCss(html);
    html = ensureScripts(html);
    if (html !== before) {
      fs.writeFileSync(htmlPath, html);
      htmlCount++;
      console.log("html", id);
    } else {
      console.log("html skip", id);
    }
  } else {
    console.log("no index.html", id);
  }

  const preloadPath = path.join(dir, "preload.js");
  if (ensurePreload(preloadPath)) {
    preloadCount++;
    console.log("preload", id);
  }
}

console.log("done", { htmlCount, preloadCount });