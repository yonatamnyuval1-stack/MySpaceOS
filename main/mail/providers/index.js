const gmail = require("./gmail");
const microsoft = require("./microsoft");
const imap = require("./imap");
const { isProviderConfigured } = require("../mail-config");

const PROVIDERS = {
  [gmail.id]: gmail,
  [microsoft.id]: microsoft,
  [imap.id]: imap,
};

function getProvider(providerId) {
  return PROVIDERS[String(providerId || "").toLowerCase()] || null;
}

function listProviders() {
  return Object.values(PROVIDERS).map((p) => ({
    id: p.id,
    label: p.label,
    configured: isProviderConfigured(p.id),
    available: p.id === "gmail",
  }));
}

module.exports = { getProvider, listProviders, PROVIDERS };
