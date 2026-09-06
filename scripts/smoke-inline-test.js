const { app, BrowserWindow } = require("electron");

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false });
  const html = `<!DOCTYPE html><html><head><style>
.btn-primary{background-color:#c9a84a;background-image:linear-gradient(red,blue);color:#111;border-radius:10px;padding:10px}
</style></head><body><button class="btn-primary" id="p">X</button></body></html>`;
  await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  const r = await win.webContents.executeJavaScript(`(() => {
    const p = document.getElementById("p");
    p.style.setProperty("background-color", "rgba(0,255,0,0.5)", "important");
    p.style.setProperty("background-image", "none", "important");
    p.style.setProperty("color", "rgb(0,0,255)", "important");
    p.style.setProperty("border-radius", "999px", "important");
    const cs = getComputedStyle(p);
    return {bg:cs.backgroundColor,img:cs.backgroundImage,color:cs.color,rad:cs.borderRadius};
  })()`);
  console.log(JSON.stringify(r));
  app.exit(0);
});
