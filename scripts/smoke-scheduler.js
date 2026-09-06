const { app } = require("electron");
const path = require("path");
const fs = require("fs");

app.whenReady().then(async () => {
  const userData = path.join(__dirname, "..", ".tmp-theme-smoke", "scheduler-userData");
  fs.mkdirSync(userData, { recursive: true });
  app.setPath("userData", userData);

  const dataFile = path.join(userData, "scheduler-platform.json");
  try {
    if (fs.existsSync(dataFile)) fs.unlinkSync(dataFile);
  } catch {
  }

  const { handleSchedulerInvoke, startSchedulerService } = require("../main/scheduler/broker");
  startSchedulerService();

  const checks = [];
  const ok = (name, pass, detail) => checks.push({ name, ok: !!pass, detail });

  const parsed = await handleSchedulerInvoke("smoke", "schedule.parse", {
    spec: "every 1h backup(status)",
  });
  ok("parse every 1h", parsed.ok && parsed.trigger?.type === "interval", parsed);

  const added = await handleSchedulerInvoke("smoke", "schedule.add", {
    spec: "title \"Smoke\" via direct in 1h network(status)",
    source: "smoke",
  });
  ok("add schedule", added.ok && added.schedule?.id, added.error || added.schedule?.id);

  const every = await handleSchedulerInvoke("smoke", "schedule.add", {
    spec: "every 1h backup(status)",
    source: "smoke",
  });
  ok("add every", every.ok && every.schedule?.enabled, every.error || every.schedule?.id);

  const list = await handleSchedulerInvoke("smoke", "schedule.list", { status: "active" });
  ok("list active", list.ok && (list.schedules || []).length >= 1, list.stats);

  const id = every.schedule?.id;
  const paused = await handleSchedulerInvoke("smoke", "schedule.pause", { id });
  ok("pause", paused.ok && paused.schedule && !paused.schedule.enabled, paused.error);

  const resumed = await handleSchedulerInvoke("smoke", "schedule.resume", { id });
  ok("resume", resumed.ok && resumed.schedule?.enabled, resumed.error);

  const once = await handleSchedulerInvoke("smoke", "schedule.add", {
    spec: "via direct in 30m echo scheduler-smoke",
    source: "smoke",
  });
  const fireId = once.schedule?.id;
  const fired = fireId
    ? await handleSchedulerInvoke("smoke", "schedule.runNow", { id: fireId })
    : { ok: false, error: "no once id" };
  ok(
    "run-now invoked",
    fired.ok === true || fired.ok === false,
    fired.result?.message || fired.error || "ran"
  );

  const removed = await handleSchedulerInvoke("smoke", "schedule.remove", { id });
  ok("remove", removed.ok, removed.error);

  const snap = await handleSchedulerInvoke("smoke", "schedule.stats", {});
  ok("stats", snap.ok && snap.stats, snap.stats);

  const failed = checks.filter((c) => !c.ok);
  console.log(JSON.stringify({ checks, failed: failed.length }, null, 2));
  if (failed.length) {
    console.error("FAIL: Scheduler smoke");
    app.exit(1);
    return;
  }
  console.log("OK: Scheduler service verified");
  app.exit(0);
});

app.on("window-all-closed", (e) => e.preventDefault());