const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

const css = fs.readFileSync(path.join(__dirname, "..", "apps", "world-clock", "styles.css"), "utf8");

function page(fragment) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
:root { --radius: 10px; --accent: #c9a84a; --accent-dim: rgba(201,168,74,.22); --bg-elevated:#1a2030; --border-strong:#3a4560; --border:#2a3348; --text:#eee; --text-muted:#aaa; --bg-panel:#111; --bg:#0b0f18; --warn:#f0a84a; }
${fragment}
</style></head><body>
<button class="btn btn-primary" id="p">P</button>
</body></html>`;
  return "data:text/html;charset=utf-8," + encodeURIComponent(html);
}

async function test(win, fragment) {
  await win.loadURL(page(fragment));
  return win.webContents.executeJavaScript(`(() => {
    const p = document.getElementById("p");
    p.style.setProperty("border-radius", "40px", "important");
    p.style.setProperty("color", "rgb(1,2,3)", "important");
    const rad = getComputedStyle(p).borderRadius;
    return { rad, color: getComputedStyle(p).color, ok: rad === "40px" };
  })()`);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true } });
  const btnIdx = css.indexOf("/* Buttons");
  const beforeBtn = css.slice(0, btnIdx);
  const btnOnly = css.slice(btnIdx);
  const simpleBtn =
    `.btn{border-radius:10px;padding:10px;border:1px solid #333;background:#222;color:#eee}.btn-primary{background:#c9a84a;color:#1a1408;border-radius:10px}`;

  const results = {
    emptyPlusSimple: await test(win, simpleBtn),
    btnOnly: await test(win, btnOnly),
    beforePlusSimple: await test(win, beforeBtn + "\n" + simpleBtn),
    full: await test(win, css),
  };

  if (!results.beforePlusSimple.ok && results.emptyPlusSimple.ok) {
    const lines = beforeBtn.split(/\n/);
    let lo = 0;
    let hi = lines.length;
    while (hi - lo > 3) {
      const mid = Math.floor((lo + hi) / 2);
      const frag = lines.slice(0, mid).join("\n") + "\n" + simpleBtn;
      const r = await test(win, frag);
      if (r.ok) lo = mid;
      else hi = mid;
    }
    results.bisect = {
      lo,
      hi,
      lineLo: lines[lo],
      lineHi: lines[hi],
      around: lines.slice(Math.max(0, lo - 2), Math.min(lines.length, hi + 5)).map((l, i) => `${lo - 2 + i + 1}|${l}`).join("\n"),
    };
  }

  console.log(JSON.stringify(results, null, 2));
  app.exit(0);
});