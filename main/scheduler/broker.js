const engine = require("./engine");

async function handleSchedulerInvoke(_caller, channel, args = {}) {
  const ch = String(channel || "").trim();
  switch (ch) {
    case "schedule.list":
    case "scheduler.list":
      return engine.list(args || {});
    case "schedule.get":
    case "scheduler.get":
      return engine.get(args || {});
    case "schedule.add":
    case "scheduler.add":
      return engine.add(args || {}, args?.source || "desktop");
    case "schedule.pause":
    case "scheduler.pause":
      return engine.pause(args || {});
    case "schedule.resume":
    case "scheduler.resume":
      return engine.resume(args || {});
    case "schedule.remove":
    case "schedule.cancel":
    case "scheduler.remove":
    case "scheduler.cancel":
      return engine.remove(args || {});
    case "schedule.runNow":
    case "schedule.run":
    case "scheduler.runNow":
      return engine.runNow(args || {});
    case "schedule.clearHistory":
    case "scheduler.clearHistory":
      return engine.clearHistory();
    case "schedule.history":
    case "scheduler.history": {
      const snap = engine.snapshot();
      const limit = Math.max(1, Math.min(200, Number(args?.limit) || 50));
      return { ok: true, history: (snap.history || []).slice(0, limit), ...snap };
    }
    case "schedule.stats":
    case "schedule.snapshot":
    case "scheduler.stats":
    case "scheduler.snapshot":
      return engine.snapshot();
    case "schedule.parse":
      return engine.parseAddSpec(args?.spec || args?.text || "");
    default:
      return { ok: false, error: `Unknown Scheduler channel: ${ch}` };
  }
}

module.exports = {
  handleSchedulerInvoke,
  startSchedulerService: engine.startSchedulerService,
  stopSchedulerService: engine.stopSchedulerService,
};
