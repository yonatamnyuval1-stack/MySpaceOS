const engine = require("../../jobs/engine");

async function enqueue(input = {}) {
  return engine.enqueue(input, input.source || "msl");
}

async function list(input = {}) {
  return engine.list(input);
}

async function stats() {
  return engine.snapshot();
}

const CAPABILITIES = [
  {
    id: "jobs.enqueue",
    kind: "action",
    provider: "jobs",
    title: "Enqueue job",
    description: "Queue a shell, script, delay, or noop job under the Jobs capacity contract",
    handler: enqueue,
  },
  {
    id: "jobs.list",
    kind: "query",
    provider: "jobs",
    title: "List jobs",
    description: "List Jobs queue entries",
    handler: list,
  },
  {
    id: "jobs.stats",
    kind: "query",
    provider: "jobs",
    title: "Jobs stats",
    description: "Queue stats and capacity snapshot",
    handler: stats,
  },
];

module.exports = { CAPABILITIES };