const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

const css = fs.readFileSync(path.join(__dirname, "..", "apps", "world-clock", "styles.css"), "utf8");
const fromButtons = css.slice(css.indexOf("/* Buttons"));
const btnLines = fromButtons.split(/\n/).slice(0, 55);

function page(fragment) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
:root { --radius: 10px; --accent: #c9a84a; --accent-dim: rgba(201,168,74,.22); --bg-elevated:#1a2030; --border-strong:#3a4560; --border:#2a3348; --text:#eee; --text-muted:#aaa; --warn:#f0a84a; --bg-hover:#243049; }
${fragment}
</style></head><body><button class="btn btn-primary" id="p">P</button></body></html>`;
  return "data:text/html;charset=utf-8," + encodeURIComponent(html);
}

async function test(win, fragment) {
  await win.loadURL(page(fragment));
  return win.webContents.executeJavaScript(`(() => {
    const p = document.getElementById("p");
    p.style.setProperty("border-radius", "40px", "important");
    p.style.setProperty("color", "rgb(1,2,3)", "important");
    p.style.setProperty("background", "rgb(4,5,6)", "important");
    return {
      rad: getComputedStyle(p).borderRadius,
      color: getComputedStyle(p).color,
      bg: getComputedStyle(p).backgroundColor,
      ok: getComputedStyle(p).borderRadius === "40px",
    };
  })()`);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true } });

  const candidates = {
    radiusLiteral: `.btn { border-radius: 10px; padding: 10px; } .btn-primary { color: #1a1408; background: #c9a84a; }`,
    radiusVarNested: `.btn { border-radius: var(--theme-btn-radius, var(--radius)); padding: 10px; } .btn-primary { color: #1a1408; background: #c9a84a; }`,
    radiusVarSimple: `.btn { border-radius: var(--theme-btn-radius, 10px); padding: 10px; } .btn-primary { color: #1a1408; background: #c9a84a; }`,
    withTransition: `.btn { border-radius: 10px; padding: 10px; transition: border-radius 0.15s; } .btn-primary { color: #1a1408; background: #c9a84a; }`,
    withBgVars: `.btn { border-radius: 10px; background: var(--theme-btn-bg, var(--bg-elevated)); padding: 10px; border: 1px solid #333; }
.btn-primary { background-color: var(--theme-btn-primary-bg, #c9a84a); background-image: var(--theme-btn-primary-image, linear-gradient(135deg, #c9a84a, var(--accent))); color: var(--theme-btn-primary-color, #1a1408); border-radius: var(--theme-btn-radius, var(--radius)); }`,
    fullBtnBlock: btnLines.join("\n"),
  };

  const out = {};
  for (const [name, frag] of Object.entries(candidates)) {
    out[name] = await test(win, frag);
  }

  let lo = 0;
  let hi = btnLines.length;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    const frag = btnLines.slice(0, mid).join("\n");
    if (!/\.btn\b/.test(frag)) {
      lo = mid;
      continue;
    }
    const r = await test(win, frag);
    if (r.ok) lo = mid;
    else hi = mid;
  }
  out.bisect = {
    hi,
    line: btnLines[hi - 1],
    around: btnLines.slice(Math.max(0, hi - 5), hi + 3).map((l, i) => `${Math.max(0, hi - 5) + i}:${l}`).join("\n"),
  };

  console.log(JSON.stringify(out, null, 2));
  app.exit(0);
});