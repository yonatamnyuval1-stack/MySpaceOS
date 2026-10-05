const gmail = require("./gmail");
const { isProviderConfigured } = require("../mail-config");

const PROVIDERS = {
  [gmail.id]: gmail,
};

function getProvider(providerId) {
  return PROVIDERS[String(providerId || "").toLowerCase()] || null;
}

function listProviders() {
  return Object.values(PROVIDERS).map((p) => ({
    id: p.id,
    label: p.label,
    configured: isProviderConfigured(p.id),
    available: true,
  }));
}

module.exports = { getProvider, listProviders, PROVIDERS };
