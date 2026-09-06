const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");

const tmpDir = path.join(__dirname, "..", ".tmp-theme-smoke");
const tmpHtml = path.join(tmpDir, "diagnose-btn.html");
const runtimePath = path.join(__dirname, "..", "apps", "shared", "theme-runtime.js");
const css = fs.readFileSync(path.join(__dirname, "..", "apps", "world-clock", "styles.css"), "utf8");

app.whenReady().then(async () => {
  fs.mkdirSync(tmpDir, { recursive: true });
  const html = `<!DOCTYPE html>
<html lang="en" data-theme="dark" data-buttons="default">
<head>
<meta charset="UTF-8" />
<style>
:root {
  --radius: 10px;
  --accent: #c9a84a;
  --accent-dim: rgba(201, 168, 74, 0.22);
  --bg-elevated: #1a2030;
  --bg-hover: #243049;
  --border-strong: #3a4560;
  --border: #2a3348;
  --text: #e8ecf4;
  --text-muted: #9aa3b5;
}
${css}
</style>
<script src="${pathToFileURL(runtimePath).href}?v=${Date.now()}"></script>
</head>
<body>
  <button class="btn btn-primary" id="p">Primary</button>
</body>
</html>`;
  fs.writeFileSync(tmpHtml, html, "utf8");

  const win = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  await win.loadURL(pathToFileURL(tmpHtml).href);

  const result = await win.webContents.executeJavaScript(`(() => {
    const p = document.getElementById("p");
    window.MySpaceThemeRuntime.apply({ mode: "dark", buttons: "soft" });

    // Manual override style for comparison
    const manual = document.createElement("style");
    manual.id = "manual-test";
    manual.textContent = 'html[data-buttons="soft"] #p { border-radius: 999px !important; color: rgb(1, 2, 3) !important; background: rgb(4, 5, 6) !important; }';
    document.head.appendChild(manual);
    void p.offsetHeight;

    const styleEl = document.getElementById("myspace-theme-buttons");
    const sheet = styleEl && styleEl.sheet;
    const rules = sheet ? [...sheet.cssRules].map((r) => ({ sel: r.selectorText, css: r.style.cssText.slice(0, 200) })) : [];
    const matchesSoft = p.matches('html[data-buttons="soft"] .btn-primary') === false
      ? "N/A-matches-on-el"
      : p.matches(".btn-primary");
    // Element.matches doesn't take ancestor selectors the same way — use matches from query
    const q = document.querySelector('html[data-buttons="soft"] .btn-primary');
    const cs = getComputedStyle(p);

    // Try inline important
    p.style.setProperty("border-radius", "40px", "important");
    const afterInline = getComputedStyle(p).borderRadius;

    return {
      dataButtons: document.documentElement.getAttribute("data-buttons"),
      queried: !!q,
      ruleCount: rules.length,
      rules,
      styleSnippet: styleEl ? styleEl.textContent.slice(0, 300) : null,
      computedBeforeInlineNote: "see radius/color/bg",
      radius: cs.borderRadius,
      color: cs.color,
      bg: cs.backgroundColor,
      afterInlineRadius: afterInline,
      matchedCSS: (() => {
        // Walk stylesheets for rules matching .btn-primary with border-radius
        const hits = [];
        for (const ss of document.styleSheets) {
          let rs;
          try { rs = [...ss.cssRules]; } catch { continue; }
          for (const r of rs) {
            if (!r.selectorText || !r.selectorText.includes("btn-primary")) continue;
            if (r.style && r.style.borderRadius) {
              hits.push({ sel: r.selectorText, br: r.style.borderRadius, important: r.style.getPropertyPriority("border-radius") });
            }
          }
        }
        return hits;
      })(),
    };
  })()`);

  console.log(JSON.stringify(result, null, 2));
  app.exit(0);
});