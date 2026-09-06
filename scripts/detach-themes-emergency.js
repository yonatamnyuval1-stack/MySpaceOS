const fs = require("fs");
const path = require("path");

const APPS = path.join(__dirname, "..", "apps");
let n = 0;

for (const name of fs.readdirSync(APPS)) {
  const htmlPath = path.join(APPS, name, "index.html");
  if (!fs.existsSync(htmlPath)) continue;
  let html = fs.readFileSync(htmlPath, "utf8");
  const before = html;

  html = html.replace(/\s*<link[^>]+theme-chrome\.css[^>]*>/gi, "");
  html = html.replace(/\s*<script[^>]+theme-runtime\.js[^>]*><\/script>/gi, "");

  html = html.replace(/<html([^>]*)>/i, (m, attrs) => {
    let a = attrs || "";
    const baseMatch = a.match(/data-theme-base="(light|dark)"/);
    const base = baseMatch ? baseMatch[1] : null;
    if (base === "light") {
      a = a.replace(/data-theme="[^"]*"/, 'data-theme="light"');
      if (!/data-theme=/.test(a)) a += ' data-theme="light"';
    } else if (base === "dark" || /theme-preload|attachThemesApi/.test(
      fs.existsSync(path.join(APPS, name, "preload.js"))
        ? fs.readFileSync(path.join(APPS, name, "preload.js"), "utf8")
        : ""
    )) {
      a = a.replace(/data-theme="[^"]*"/, 'data-theme="dark"');
      if (!/data-theme=/.test(a)) a += ' data-theme="dark"';
      if (!/data-theme-base=/.test(a)) a += ' data-theme-base="dark"';
    }
    a = a.replace(/data-buttons="[^"]*"/, 'data-buttons="default"');
    if (!/data-buttons=/.test(a)) a += ' data-buttons="default"';
    a = a.replace(/\s*class="[^"]*theme-light[^"]*"/, (cm) => {
      return cm.replace(/theme-light/g, "").replace(/class="\s*"/, "");
    });
    return `<html${a}>`;
  });

  if (html !== before) {
    fs.writeFileSync(htmlPath, html);
    n++;
  }
}

console.log("detached themes from", n, "apps");
