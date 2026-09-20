const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dir = path.join(__dirname, "..", "apps", "docs");
const window = {};
const ctx = { window, console, globalThis: null };
ctx.globalThis = ctx;
ctx.window = window;

for (const file of [
  "catalog.js",
  "catalog-pages.js",
  "catalog-apps.js",
  "catalog-deep.js",
  "catalog-platform.js",
]) {
  const code = fs.readFileSync(path.join(dir, file), "utf8");
  vm.runInNewContext(code, ctx, { filename: file });
}

const pages = ctx.window.DOCS_PAGES || {};
const groups = ctx.window.DOCS_GROUPS || [];
const need = [
  "command-palette",
  "app-rail-series",
  "workspace-tabs",
  "desktop-spaces",
  "i18n-languages",
  "app-ui-language",
  "accounts-local-auth",
  "link-stack",
  "platform-services",
  "app-coupons",
  "app-pulse",
  "app-parts",
  "app-resolve",
  "app-scheduler",
  "app-permissions",
  "app-themes",
  "app-network",
  "app-backup",
  "app-storage-svc",
  "app-updates",
  "app-bridge",
  "app-shell",
  "app-browser",
  "app-info",
  "app-console",
  "apps-directory",
  "settings",
];
const missing = need.filter((id) => !pages[id]);
console.log("total pages", Object.keys(pages).length);
console.log("missing required", missing);
const dirTable = (pages["apps-directory"]?.blocks || []).find(
  (b) => b.type === "table" && b.headers?.[0] === "App"
);
console.log("directory app rows", dirTable?.rows?.length || 0);
const infoTitle = pages["app-info"]?.title;
console.log("app-info title", infoTitle);
