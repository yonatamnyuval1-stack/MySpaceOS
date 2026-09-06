const {
  connectProvider,
  disconnectAccount,
  accountStatus,
  listMessages,
  getMessage,
  listLabels,
  syncAccount,
  syncAll,
} = require("./mail-service");
const { listProviders } = require("./providers");
const { configStatus } = require("./mail-config");
const { broadcastMailEvent } = require("./mail-events");
const hub = require("./hub-service");

async function connectAndBroadcast(providerId) {
  const result = await connectProvider(providerId);
  broadcastMailEvent("connect-result", result);
  return result;
}

async function handleMailInvoke(action, args = {}) {
  const act = String(action || "");

  switch (act) {
    case "providers.list":
      return { ok: true, providers: listProviders() };

    case "config.status":
      return { ok: true, ...configStatus() };

    case "accounts.list":
    case "status":
      return accountStatus();

    case "accounts.connect":
      return connectAndBroadcast(String(args.provider || args.providerId || "gmail"));

    case "accounts.disconnect":
      return disconnectAccount(String(args.accountId || args.id || ""));

    case "messages.list":
      return listMessages(String(args.accountId || ""), {
        maxResults: args.maxResults,
        labelIds: args.labelIds,
        q: args.q,
        pageToken: args.pageToken,
        cacheOnly: args.cacheOnly === true,
      });

    case "messages.get":
      return getMessage(String(args.accountId || ""), String(args.messageId || args.id || ""));

    case "labels.list":
      return listLabels(String(args.accountId || ""), { cacheOnly: args.cacheOnly === true });

    case "sync.now":
      if (args.accountId) return syncAccount(String(args.accountId), { notify: args.notify !== false });
      return syncAll({ notify: args.notify !== false });

    case "hub.catalog":
      return hub.catalog();
    case "hub.list":
      return hub.listConnections();
    case "hub.connect":
      return hub.connectService(args);
    case "hub.disconnect":
      return hub.disconnectService(args);
    case "hub.open":
      return hub.resolveOpen(args);
    case "hub.openExternal":
      return hub.openOfficial(args);
    case "hub.openInShell":
      return hub.openInShell(args);
    case "hub.ensure":
      return hub.ensureConnected(args.serviceId || args.id);

    default:
      return { ok: false, error: `Unknown mail action: ${act}` };
  }
}

module.exports = { handleMailInvoke };