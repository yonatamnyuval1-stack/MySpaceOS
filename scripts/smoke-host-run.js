const { app } = require("electron");
const path = require("path");
const fs = require("fs");

app.whenReady().then(async () => {
  const userData = path.join(__dirname, "..", ".tmp-theme-smoke", "host-run-userData");
  fs.mkdirSync(userData, { recursive: true });
  app.setPath("userData", userData);

  const jobsFile = path.join(userData, "jobs-platform.json");
  try {
    if (fs.existsSync(jobsFile)) fs.unlinkSync(jobsFile);
  } catch {
  }

  const { handleFilesInvoke } = require("../main/apps/files-ipc");
  const { handleHostInvoke } = require("../main/apps/host-ipc");
  const jobsStore = require("../main/jobs/store");
  const checks = [];
  const ok = (name, pass, detail) => checks.push({ name, ok: !!pass, detail });

  await handleFilesInvoke("dir.mkdir", { path: "tools/host-smoke" });
  const scriptBody = 'console.log("host-smoke-ok");';
  const wrote = await handleFilesInvoke("file.write", {
    path: "tools/host-smoke/run.js",
    content: scriptBody,
  });
  ok("seed script", wrote.ok, wrote);

  const which = await handleHostInvoke("host.which", { runtime: "node" });
  ok("which node", which.ok, which);

  if (!which.found) {
    ok("run node script", false, "node not on PATH — skip run");
  } else {
    const ran = await handleHostInvoke("host.run", {
      runtime: "node",
      scriptPath: "file:tools/host-smoke/run.js",
    });
    ok(
      "run node script",
      ran.ok && String(ran.stdout || "").includes("host-smoke-ok"),
      { stdout: ran.stdout, stderr: ran.stderr, error: ran.error }
    );
  }

  const outside = await handleHostInvoke("host.run", {
    runtime: "node",
    scriptPath: "file:../outside.js",
  });
  ok("sandbox blocks script", !outside.ok, outside.error);

  const state = jobsStore.load();
  state.capacity = jobsStore.normalizeCapacity({ ...state.capacity, allowHost: false });
  jobsStore.save(state);

  const blocked = await handleHostInvoke("host.run", {
    runtime: "node",
    scriptPath: "file:tools/host-smoke/run.js",
  });
  ok("permission gate", !blocked.ok && /blocked/i.test(blocked.error || ""), blocked.error);

  const failed = checks.filter((c) => !c.ok);
  console.log(JSON.stringify({ checks, failed: failed.length }, null, 2));
  if (failed.length) {
    console.error("FAIL: host(run) smoke");
    app.exit(1);
    return;
  }
  console.log("OK: host(run) verified");
  app.exit(0);
});

app.on("window-all-closed", (e) => e.preventDefault());
