const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");

const tmpDir = path.join(__dirname, "..", ".tmp-theme-smoke");
const brokenPreloadHelper = path.join(tmpDir, "broken-theme-preload.js");
const goodPreload = path.join(tmpDir, "preload-expose-first.js");
const brokenAttachPreload = path.join(tmpDir, "preload-with-broken-attach.js");
const html = path.join(tmpDir, "blank.html");

fs.mkdirSync(tmpDir, { recursive: true });
fs.writeFileSync(
  brokenPreloadHelper,
  `throw new Error("simulated theme-preload failure");\n`,
  "utf8"
);
fs.writeFileSync(
  goodPreload,
  `
const { contextBridge, ipcRenderer } = require("electron");
const path = require("path");
const myApp = { moduleId: "smoke-notes", invoke: () => {} };
contextBridge.exposeInMainWorld("myApp", myApp);
try {
  const { attachThemesApi } = require(path.join(__dirname, "broken-theme-preload.js"));
  attachThemesApi(contextBridge, ipcRenderer, "smoke-notes");
} catch (err) {
  console.error("[smoke] Themes bridge failed (expected):", err.message);
}
`,
  "utf8"
);
fs.writeFileSync(
  brokenAttachPreload,
  `
const { contextBridge, ipcRenderer } = require("electron");
const path = require("path");
const myApp = { moduleId: "smoke-bad" };
// UNSAFE pattern (what used to break apps): require before expose without isolating expose
const { attachThemesApi } = require(path.join(__dirname, "broken-theme-preload.js"));
attachThemesApi(contextBridge, ipcRenderer, "smoke-bad");
contextBridge.exposeInMainWorld("myApp", myApp);
`,
  "utf8"
);
fs.writeFileSync(html, "<!DOCTYPE html><html><body>ok</body></html>", "utf8");

async function probe(preloadPath) {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: preloadPath,
    },
  });
  await win.loadFile(html);
  const result = await win.webContents.executeJavaScript(
    `({ myApp: typeof window.myApp, moduleId: window.myApp && window.myApp.moduleId, themes: typeof window.myAppThemes })`
  );
  win.destroy();
  return result;
}

app.whenReady().then(async () => {
  const safe = await probe(goodPreload);
  let unsafe;
  try {
    unsafe = await probe(brokenAttachPreload);
  } catch (err) {
    unsafe = { error: String(err?.message || err), myApp: "undefined" };
  }

  const checks = [
    { name: "safe: myApp object", ok: safe.myApp === "object" },
    { name: "safe: moduleId", ok: safe.moduleId === "smoke-notes" },
    { name: "unsafe: myApp missing (proves the bug)", ok: unsafe.myApp !== "object" },
  ];
  const failed = checks.filter((c) => !c.ok);
  console.log(JSON.stringify({ safe, unsafe, checks }, null, 2));
  if (failed.length) {
    console.error("FAIL", failed.map((f) => f.name).join("; "));
    app.exit(1);
    return;
  }
  console.log("OK: expose-first survives broken theme-preload; unsafe pattern loses myApp");
  app.exit(0);
});