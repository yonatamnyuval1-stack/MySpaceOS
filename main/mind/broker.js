const engine = require("./engine");
const { handleMemoryInvoke } = require("./memory");

async function handleMindInvoke(_caller, channel, args = {}) {
  const ch = String(channel || "").trim();
  if (ch.startsWith("mind.memory.")) {
    return handleMemoryInvoke(ch, args);
  }
  switch (ch) {
    case "mind.status":
    case "mind.snapshot":
      return engine.snapshot();
    case "mind.providers":
      return engine.listProviders();
    case "mind.settings.set":
      return engine.setSettings(args || {});
    case "mind.key.set":
      return engine.setApiKey(args || {});
    case "mind.key.clear":
      return engine.clearApiKey(args || {});
    case "mind.complete":
    case "mind.ask":
      return engine.complete(args || {});
    case "mind.chat":
      return engine.chat(args || {});
    case "mind.test":
      return engine.testProvider(args || {});
    default:
      return { ok: false, error: `Unknown Mind channel: ${ch}` };
  }
}

module.exports = { handleMindInvoke, startMindService: engine.startMindService };