const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { handleMyAppInvoke } = require("../main/apps/ipc");

ipcMain.handle("myapp-invoke", async (_event, moduleId, channel, args) => {
  return handleMyAppInvoke(moduleId, channel, args, _event);
});

app.whenReady().then(async () => {
  const root = path.join(__dirname, "..");
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(root, "apps/geography/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await win.loadFile(path.join(root, "apps/geography/index.html"));
  await new Promise((r) => setTimeout(r, 1200));

  const run = async () =>
    win.webContents.executeJavaScript(`
      (async () => {
        await window.AppSettings.show();
        const btn = document.querySelector('#page-app-settings .settings-toggle[data-key="showFlags"]');
        btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        await new Promise((r) => setTimeout(r, 300));
        return {
          on: btn.classList.contains("is-on"),
          saved: window.AppSettings.settings.showFlags,
          showFlags: window.Geo.showFlags(),
          hideClass: document.getElementById("app-shell").classList.contains("geo-hide-flags"),
        };
      })()
    `);

  await win.webContents.executeJavaScript(`window.myApp.invoke("settings.set", { key: "showFlags", value: true })`);
  const off = await run();
  const on = await run();
  console.log("OFF", JSON.stringify(off));
  console.log("ON", JSON.stringify(on));
  const pass = !off.on && off.saved === false && !off.showFlags && off.hideClass && on.on && on.saved === true && on.showFlags;
  console.log(pass ? "PASS" : "FAIL");
  app.quit();
  process.exit(pass ? 0 : 1);
});
