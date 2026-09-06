const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const APPS_DIR = path.join(ROOT, "apps");
const CACHE = "20260825v3";
const { THEME_CATALOG, getTheme } = require("../main/apps/themes-ipc");

function patchHtml(appId, defaultMode) {
  const file = path.join(APPS_DIR, appId, "index.html");
  if (!fs.existsSync(file)) return { ok: false, reason: "no html" };

  let mode = defaultMode === "light" ? "light" : "dark";
  let buttons = "default";
  try {
    const res = getTheme(appId);
    if (res?.ok && res.theme) {
      mode = res.theme.mode || mode;
      buttons = res.theme.buttons || buttons;
    }
  } catch {
  }

  let html = fs.readFileSync(file, "utf8");

  html = html.replace(/\s*<script[^>]+theme-runtime\.js[^>]*><\/script>/gi, "");

  html = html.replace(/<html([^>]*)>/i, (_m, attrs) => {
    let a = attrs || "";
    if (/data-theme=/.test(a)) a = a.replace(/data-theme="[^"]*"/, `data-theme="${mode}"`);
    else a += ` data-theme="${mode}"`;
    if (/data-buttons=/.test(a)) a = a.replace(/data-buttons="[^"]*"/, `data-buttons="${buttons}"`);
    else a += ` data-buttons="${buttons}"`;
    if (/data-theme-base=/.test(a)) {
      a = a.replace(/data-theme-base="[^"]*"/, `data-theme-base="${defaultMode === "light" ? "light" : "dark"}"`);
    } else {
      a += ` data-theme-base="${defaultMode === "light" ? "light" : "dark"}"`;
    }
    if (mode === "light") {
      if (/\bclass="[^"]*"/.test(a)) {
        a = a.replace(/\bclass="([^"]*)"/, (_cm, cls) => {
          const parts = cls.split(/\s+/).filter(Boolean).filter((c) => c !== "theme-light");
          parts.push("theme-light");
          return `class="${parts.join(" ")}"`;
        });
      } else if (!/\btheme-light\b/.test(a)) {
        a += ` class="theme-light"`;
      }
    } else {
      a = a.replace(/\bclass="([^"]*)"/, (_cm, cls) => {
        const parts = cls.split(/\s+/).filter(Boolean).filter((c) => c !== "theme-light");
        return parts.length ? `class="${parts.join(" ")}"` : "";
      });
    }
    return `<html${a}>`;
  });

  if (!/theme-chrome\.css/.test(html)) {
    if (/styles\.css[^"]*"/.test(html)) {
      html = html.replace(
        /(<link[^>]+styles\.css[^>]*>)/i,
        `$1\n    <link rel="stylesheet" href="../shared/theme-chrome.css?v=${CACHE}" />`
      );
    } else if (/<\/head>/i.test(html)) {
      html = html.replace(
        /<\/head>/i,
        `    <link rel="stylesheet" href="../shared/theme-chrome.css?v=${CACHE}" />\n  </head>`
      );
    }
  } else {
    html = html.replace(/theme-chrome\.css\?v=[^"]+/g, `theme-chrome.css?v=${CACHE}`);
  }

  fs.writeFileSync(file, html);
  return { ok: true };
}

function assertPreloadClean(appId) {
  const file = path.join(APPS_DIR, appId, "preload.js");
  if (!fs.existsSync(file)) return { ok: true, skipped: true };
  const src = fs.readFileSync(file, "utf8");
  if (/theme-preload|attachThemesApi|Themes bridge failed/.test(src)) {
    return { ok: false, reason: "preload still has themes hooks" };
  }
  return { ok: true };
}

const results = [];
for (const def of Object.values(THEME_CATALOG)) {
  const id = def.id;
  if (!fs.existsSync(path.join(APPS_DIR, id))) {
    results.push({ id, skip: "missing" });
    console.log(id, "SKIP");
    continue;
  }
  const html = patchHtml(id, def.defaultMode || "dark");
  const preload = assertPreloadClean(id);
  results.push({ id, html, preload });
  console.log(
    id,
    "html=" + (html.ok ? "ok" : html.reason),
    "preload=" + (preload.ok ? "clean" : preload.reason)
  );
}

const failed = results.filter((r) => (r.html && !r.html.ok) || (r.preload && !r.preload.ok));
fs.mkdirSync(path.join(ROOT, ".tmp-theme-smoke"), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, ".tmp-theme-smoke", "rewire-v3.json"),
  JSON.stringify({ cache: CACHE, results }, null, 2)
);
console.log("done", results.length, "failed", failed.length ? failed.map((f) => f.id).join(",") : "none");
if (failed.length) process.exitCode = 1;