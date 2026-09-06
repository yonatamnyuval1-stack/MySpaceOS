const engine = require("./engine");

async function handleResolveInvoke(caller, channel, args = {}) {
  const ch = String(channel || "").trim();
  switch (ch) {
    case "resolve.report":
    case "report":
      return engine.report(args || {}, caller);
    case "resolve.ask":
    case "ask":
      return engine.ask(args || {});
    case "resolve.list":
    case "list":
      return engine.list(args || {});
    case "resolve.get":
    case "get":
      return engine.get(args || {});
    case "resolve.apply":
    case "apply":
      return engine.apply(args || {}, caller);
    case "resolve.dismiss":
    case "dismiss":
      return engine.dismiss(args || {});
    case "resolve.clear":
    case "clear":
      return engine.clear(args || {});
    case "resolve.status":
    case "status":
      return engine.status();
    case "resolve.playbooks":
    case "playbooks":
      return engine.listPlaybooks();
    default:
      return { ok: false, error: `Unknown Resolve channel: ${ch}` };
  }
}

module.exports = { handleResolveInvoke };
