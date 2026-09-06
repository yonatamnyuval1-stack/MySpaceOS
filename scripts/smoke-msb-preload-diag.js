const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");

const preloadFs = path.join(__dirname, "..", "apps", "myspace-browser", "preload.js");
const preloadUrl = pathToFileURL(preloadFs).href;
const homeUrl = pathToFileURL(path.join(__dirname, "..", "apps", "myspace-browser", "home.html")).href;

app.commandLine.appendSwitch("disable-site-isolation-trials");

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
    },
  });

  const cases = [
    { name: "fs-path", preload: preloadFs },
    { name: "file-url", preload: preloadUrl },
    { name: "fs-forward", preload: preloadFs.replace(/\\/g, "/") },
  ];

  const out = [];
  for (const c of cases) {
    const host = path.join(__dirname, "..", ".tmp-theme-smoke", `msb-${c.name}.html`);
    fs.mkdirSync(path.dirname(host), { recursive: true });
    const attr = String(c.preload).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    fs.writeFileSync(
      host,
      `<!DOCTYPE html><html><body>
      <webview id="v" src="${homeUrl}" preload="${attr}"
        partition="persist:msb-smoke-${c.name}"
        webpreferences="contextIsolation=true,nodeIntegration=false,webSecurity=false"
        style="width:800px;height:600px"></webview>
      <pre id="log"></pre>
      <script>
        const v = document.getElementById("v");
        const log = (m) => { document.getElementById("log").textContent += m + "\\n"; };
        window.__probe = new Promise((resolve) => {
          v.addEventListener("did-fail-load", (e) => {
            log("fail " + e.errorCode + " " + e.errorDescription);
          });
          v.addEventListener("console-message", (e) => log("console:" + e.message));
          v.addEventListener("did-finish-load", async () => {
            try {
              const probe = await v.executeJavaScript(
                "({ hasApi: !!window.myspaceBrowser, hasMyApp: !!window.myApp, href: location.href, keys: window.myspaceBrowser ? Object.keys(window.myspaceBrowser) : [] })"
              );
              resolve(probe);
            } catch (err) {
              resolve({ error: String(err && err.message || err) });
            }
          });
        });
      </script></body></html>`,
      "utf8"
    );

    await win.loadFile(host);
    await new Promise((r) => setTimeout(r, 3000));
    const result = await win.webContents.executeJavaScript("window.__probe");
    const logText = await win.webContents.executeJavaScript(
      "document.getElementById('log').textContent"
    );
    out.push({ case: c.name, preload: c.preload, result, logText });
  }

  console.log(JSON.stringify(out, null, 2));
  const ok = out.some((o) => o.result?.hasApi);
  app.exit(ok ? 0 : 1);
});