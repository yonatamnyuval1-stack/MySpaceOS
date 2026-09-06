const path = require("path");
const fs = require("fs");
const os = require("os");

const root = path.join(__dirname, "..");
process.chdir(root);

const smokeUserData = path.join(os.tmpdir(), "my-space-smoke-shell");
fs.mkdirSync(smokeUserData, { recursive: true });

const electron = require("electron");
const { app, BrowserWindow } = electron;
app.setPath("userData", smokeUserData);

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail == null ? "" : String(detail).slice(0, 240) });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? " — " + String(detail).slice(0, 160) : ""}`);
}

let finished = false;
function finish(code) {
  if (finished) return;
  finished = true;
  try {
    clearInterval(pollTimer);
  } catch {
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n===SUMMARY=== ${results.length - failed}/${results.length} passed`);
  setTimeout(() => process.exit(failed ? 1 : code || 0), 200);
  app.exit(failed ? 1 : code || 0);
}

const RENDERER_SMOKE = `
(async () => {
  const out = [];
  const push = (name, ok, detail) =>
    out.push({ name, ok: !!ok, detail: detail == null ? "" : String(detail).slice(0, 200) });

  const waitFor = async (pred, ms = 8000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if (pred()) return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  };

  const ready = await waitFor(() => !!(window.MySpaceShellCommands?.executeProgram && window.MySpaceConfig?.getApps));
  if (!ready) {
    push("shell.ready", false, "API not ready");
    return out;
  }
  push("shell.ready", true, "");

  const SC = window.MySpaceShellCommands;
  const fresh = () => SC.createScope(null);
  const ctx = {
    getApps: () => window.MySpaceConfig?.getApps?.() || [],
    showToast: () => {},
  };
  const run = (body) =>
    SC.executeProgram(body, ctx, { scope: fresh(), stopOnError: true });

  let r;

  r = await run("let n = 3\\nvars");
  push("let.literal", r.ok && /n=3/.test(r.message || ""), r.message || r.error);

  r = await run('let s = "hi"\\nvars');
  push("let.string", r.ok && /s=hi/.test(r.message || ""), r.message || r.error);

  r = await run("let item = 1");
  push("let.reserved.item", !r.ok, r.error || r.message);

  r = await run("let a = 1\\nunset a\\nvars");
  push("unset", r.ok && !/\\ba=/.test(r.message || ""), r.message || r.error);

  r = await run("let a = 1\\nlet b = $a\\nvars");
  push("let.sub", r.ok && /b=1/.test(r.message || ""), r.message || r.error);

  r = await SC.execute("let a = 1; let b = 2; vars", ctx, 0, fresh());
  push("let.chain", r.ok && /a=1/.test(r.message || "") && /b=2/.test(r.message || ""), r.message || r.error);

  r = await run("fn say(who) { let x = 1 }\\nsay(Yo)\\nvars");
  push("fn.scope", r.ok && !/\\bx=/.test(r.message || ""), r.message || r.error);

  r = await run("fn pair(a, b) { let x = 1 }\\npair(1)");
  push("fn.missingArg", r.ok, r.message || r.error);

  r = await run("fn pair(a, b) { let x = 1 }\\npair(1, 2, 3)");
  push("fn.tooManyArgs", !r.ok, r.error || r.message);

  r = await run("fn let() { let x = 1 }");
  push("fn.reserved", !r.ok, r.error || r.message);

  r = await run("fn today(x) { let a = 1 }");
  push("fn.shadowApp", !r.ok, r.error || r.message);

  r = await run("fn nop() { }\\nnop()");
  push("fn.emptyBody", r.ok, r.message || r.error);

  r = await run("fn pulse() { let a = 1 }\\nlet start = pulse()\\nvars");
  push("fn.capture", r.ok && /start=/.test(r.message || ""), r.message || r.error);

  r = await SC.execute("fn say(who) { let x = 1 }; say(Yo); fn list", ctx, 0, fresh());
  push("fn.chainCall", r.ok && /say\\(who\\)/.test(r.message || ""), r.message || r.error);

  // $param expansion (dollar built via concat so the outer template stays valid)
  r = await run(["fn echo(v) {", "  let out = $".concat("v"), "}", "echo(hi)", "vars"].join("\\n"));
  push("fn.paramExpand", r.ok && !/\\bout=/.test(r.message || ""), r.message || r.error);

  r = await SC.execute("help lang", ctx);
  push("help.lang", r.ok && /let /.test(r.message || ""), (r.message || r.error || "").slice(0, 80));

  r = await SC.execute("help backup", ctx);
  push("help.backup", r.ok && /backup\\(export\\)/.test(r.message || ""), (r.message || r.error || "").slice(0, 80));

  try {
    const bak = await window.mySpace?.backup?.status?.();
    push("backup.status", !!(bak && bak.ok && bak.path), bak?.path || bak?.error || "no api");
  } catch (e) {
    push("backup.status", false, String(e));
  }

  try {
    const scripts = await window.mySpace?.scripts?.list?.();
    const names = (scripts?.scripts || []).map((s) => s.name);
    push(
      "scripts.starters",
      !!(scripts?.ok && ["morning", "focus", "eod", "remote"].every((n) => names.includes(n))),
      names.join(",")
    );
  } catch (e) {
    push("scripts.starters", false, String(e));
  }

  const wp = window.MySpaceConfig?.getSettings?.()?.wallpaper;
  const applied = document.querySelector(".shell")?.dataset?.wallpaper;
  push("wallpaper.apply", !!(wp && applied), "settings=" + wp + " shell=" + applied);

  const hasPhotos = (window.MySpaceWallpapers?.list || []).some((w) => w.photo);
  push("wallpaper.photos", hasPhotos, "count=" + (window.MySpaceWallpapers?.list || []).length);

  r = await SC.execute("docs(help)", ctx);
  push("docs.help", r.ok, (r.message || r.error || "").slice(0, 80));

  return out;
})()
`;

let started = false;
let running = false;
async function runWhenReady() {
  if (started || finished || running) return;
  const wins = BrowserWindow.getAllWindows().filter((w) => w && !w.isDestroyed());
  if (!wins.length) return;
  const win = wins[0];
  try {
    const live = await win.webContents.executeJavaScript(
      "!!(window.MySpaceShellCommands && window.MySpaceConfig)"
    );
    if (!live) return;
  } catch {
    return;
  }
  running = true;
  started = true;
  try {
    const report = await win.webContents.executeJavaScript(RENDERER_SMOKE);
    for (const row of report || []) record(row.name, row.ok, row.detail);
    finish(0);
  } catch (err) {
    record("smoke.runner", false, String(err));
    finish(1);
  }
}

app.on("browser-window-created", (_e, win) => {
  win.webContents.on("did-finish-load", () => {
    setTimeout(runWhenReady, 500);
  });
});

const pollTimer = setInterval(() => {
  if (!finished && !started) runWhenReady();
}, 1000);

require(path.join(root, "main.js"));

setTimeout(() => {
  if (!finished) {
    record("smoke.timeout", false, "45s — is another My Space instance locking the profile?");
    finish(2);
  }
}, 45000);
