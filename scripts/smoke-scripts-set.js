const { app } = require("electron");
const path = require("path");
const fs = require("fs");

app.whenReady().then(async () => {
  const userData = path.join(__dirname, "..", ".tmp-theme-smoke", "scripts-set-userData");
  fs.mkdirSync(userData, { recursive: true });
  app.setPath("userData", userData);

  const dataFile = path.join(userData, "scripts.json");
  try {
    if (fs.existsSync(dataFile)) fs.unlinkSync(dataFile);
  } catch {
  }

  const { handleScriptsInvoke } = require("../main/apps/scripts-ipc");
  const checks = [];
  const ok = (name, pass, detail) => checks.push({ name, ok: !!pass, detail });

  const created = await handleScriptsInvoke("scripts.set", {
    name: "smoke-write",
    body: "today(list)\nsys(cpu)",
  });
  ok("set creates", created.ok && created.created && created.script?.name === "smoke-write", created);

  const got = await handleScriptsInvoke("scripts.get", { name: "smoke-write" });
  ok(
    "set body persisted",
    got.ok && got.script?.body?.includes("today(list)"),
    got.script?.body?.slice(0, 80)
  );

  const updated = await handleScriptsInvoke("scripts.set", {
    name: "smoke-write",
    body: "network(status)",
  });
  ok("set updates", updated.ok && !updated.created && updated.script?.body === "network(status)", updated);

  const appended = await handleScriptsInvoke("scripts.append", {
    name: "smoke-write",
    text: "backup(status)",
  });
  ok(
    "append adds line",
    appended.ok &&
      appended.script?.body?.includes("network(status)") &&
      appended.script?.body?.includes("backup(status)"),
    appended.script?.body
  );

  const appendNew = await handleScriptsInvoke("scripts.append", {
    name: "smoke-new",
    text: "jobs(list)",
  });
  ok("append creates if missing", appendNew.ok && appendNew.created, appendNew.script?.name);

  const failed = checks.filter((c) => !c.ok);
  console.log(JSON.stringify({ checks, failed: failed.length }, null, 2));
  if (failed.length) {
    console.error("FAIL: scripts set/append smoke");
    app.exit(1);
    return;
  }
  console.log("OK: scripts(set/append) verified");
  app.exit(0);
});

app.on("window-all-closed", (e) => e.preventDefault());