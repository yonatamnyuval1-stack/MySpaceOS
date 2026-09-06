const { app } = require("electron");
const path = require("path");
const fs = require("fs");

app.whenReady().then(async () => {
  const userData = path.join(__dirname, "..", ".tmp-theme-smoke", "app-scaffold-userData");
  fs.mkdirSync(userData, { recursive: true });
  app.setPath("userData", userData);

  for (const f of ["jobs-platform.json", "user-apps-registry.json"]) {
    try {
      const p = path.join(userData, f);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch {
    }
  }

  const userApps = path.join(userData, "user-apps");
  try {
    if (fs.existsSync(userApps)) fs.rmSync(userApps, { recursive: true, force: true });
  } catch {
  }

  const { handleAppBuilderInvoke } = require("../main/apps/app-builder-ipc");
  const { handleHostInvoke } = require("../main/apps/host-ipc");
  const { isUserAppModule } = require("../main/apps/user-app-ipc");
  const checks = [];
  const ok = (name, pass, detail) => checks.push({ name, ok: !!pass, detail });

  const scaffold = await handleAppBuilderInvoke("app.scaffold", {
    id: "smoke-todo",
    name: "Smoke Todo",
    template: "minimal",
    register: false,
  });
  ok("scaffold", scaffold.ok && scaffold.app?.id === "smoke-todo", scaffold);

  ok(
    "app files exist",
    fs.existsSync(path.join(userData, "user-apps", "smoke-todo", "index.html")),
    path.join(userData, "user-apps", "smoke-todo")
  );

  ok("is user app module", isUserAppModule("smoke-todo"), true);

  const listed = await handleAppBuilderInvoke("app.list", {});
  ok("list includes app", listed.ok && listed.apps?.some((a) => a.id === "smoke-todo"), listed);

  const registered = await handleAppBuilderInvoke("app.register", { id: "smoke-todo" });
  ok("register", registered.ok, registered);

  const which = await handleHostInvoke("host.which", { runtime: "node" });
  if (which.found) {
    const hostRun = await handleHostInvoke("host.run", {
      runtime: "node",
      scriptPath: "file:tools/smoke-todo/main.js",
    });
    ok("host run tool", hostRun.ok, hostRun.stdout || hostRun.error);
  } else {
    ok("host run tool", true, "node not on PATH — skipped");
  }

  const packed = await handleAppBuilderInvoke("app.pack.build", { id: "smoke-todo" });
  ok("pack build", packed.ok && fs.existsSync(packed.path), packed);

  const blockedState = require("../main/jobs/store").load();
  blockedState.capacity = require("../main/jobs/store").normalizeCapacity({
    ...blockedState.capacity,
    allowAppBuild: false,
  });
  require("../main/jobs/store").save(blockedState);

  const blocked = await handleAppBuilderInvoke("app.scaffold", { id: "blocked-app" });
  ok("permission gate", !blocked.ok && /blocked/i.test(blocked.error || ""), blocked.error);

  const failed = checks.filter((c) => !c.ok);
  console.log(JSON.stringify({ checks, failed: failed.length }, null, 2));
  if (failed.length) {
    console.error("FAIL: app scaffold smoke");
    app.exit(1);
    return;
  }
  console.log("OK: app(scaffold/build) verified");
  app.exit(0);
});

app.on("window-all-closed", (e) => e.preventDefault());