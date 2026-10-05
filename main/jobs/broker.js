const engine = require("./engine");
async function handleJobsInvoke(_caller, channel, args = {}) {
  const ch = String(channel || "").trim();
  switch (ch) {
    case "jobs.list":
      return engine.list(args || {});
    case "jobs.get":
      return engine.get(args || {});
    case "jobs.enqueue":
      return engine.enqueue(args || {}, args?.source || "desktop");
    case "jobs.run":
    case "jobs.activity":
      return engine.runActivity(args || {}, args?.source || "desktop");
    case "jobs.cancel":
      return engine.cancel(args || {});
    case "jobs.retry":
      return engine.retry(args || {});
    case "jobs.clearFinished":
      return engine.clearFinished();
    case "jobs.capacity.get":
      return engine.getCapacity();
    case "jobs.capacity.set":
      return engine.setCapacity(args || {});
    case "jobs.stats":
    case "jobs.snapshot":
      return engine.snapshot();
    default:
      return { ok: false, error: `Unknown Jobs channel: ${ch}` };
  }
}
module.exports = { handleJobsInvoke, startJobsService: engine.startJobsService };