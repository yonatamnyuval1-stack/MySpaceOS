const engine = require("../../mind/engine");
const memory = require("../../mind/memory");

async function ask(input = {}) {
  return engine.complete({
    prompt: input.prompt || input.q || input.text || "",
    system: input.system,
    provider: input.provider,
    model: input.model,
    task: input.task || input.route || input.tier,
    route: input.route,
  });
}

async function status() {
  return engine.snapshot();
}

async function memoryList() {
  return memory.listFacts();
}

const CAPABILITIES = [
  {
    id: "mind.ask",
    kind: "action",
    provider: "mind",
    title: "Ask Mind",
    description: "Ask Mind with a task tier: quick (cheap), chat, or think (expensive)",
    handler: ask,
  },
  {
    id: "mind.status",
    kind: "query",
    provider: "mind",
    title: "Mind status",
    description: "Tasks, models, and budget snapshot",
    handler: status,
  },
  {
    id: "mind.memory.list",
    kind: "query",
    provider: "mind",
    title: "Mind memory list",
    description: "Long-term facts and preferences Mind remembers",
    handler: memoryList,
  },
];

module.exports = { CAPABILITIES };