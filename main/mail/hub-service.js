const path = require("path");
const { pathToFileURL } = require("url");
const { shell } = require("electron");
const { publicCatalog, getService } = require("./hub-catalog");
const store = require("./hub-store");
const { broadcastMailEvent } = require("./mail-events");

function myspaceBrowserHomeUrl() {
  return pathToFileURL(path.join(__dirname, "..", "..", "apps", "myspace-browser", "home.html")).href;
}

function myspaceBrowserPreloadPath() {
  return path.join(__dirname, "..", "..", "apps", "myspace-browser", "preload.js");
}

function getMyspaceBrowserHome() {
  const preloadPath = myspaceBrowserPreloadPath();
  return {
    ok: true,
    url: myspaceBrowserHomeUrl(),
    preload: preloadPath,
    preloadPath,
    iconUrl: pathToFileURL(path.join(__dirname, "..", "..", "apps", "myspace-browser", "logo.png")).href,
    name: "My Space Browser",
    serviceId: "myspace-browser",
  };
}

async function verifyConnection(serviceId) {
  const service = getService(serviceId);
  if (!service) return { ok: false, error: "Unknown service" };
  return { ok: true, displayName: service.name };
}

async function catalog() {
  return { ok: true, services: publicCatalog() };
}

async function listConnections() {
  return { ok: true, connections: store.listPublic() };
}

async function connectService(args = {}) {
  const service = getService(args.serviceId);
  if (!service) return { ok: false, error: "Unknown service" };

  const fields = args.fields && typeof args.fields === "object" ? args.fields : {};
  for (const f of service.fields || []) {
    if (f.required && !String(fields[f.key] || "").trim()) {
      return { ok: false, error: `${f.label} is required` };
    }
  }

  const verified = await verifyConnection(service.id);
  if (!verified.ok) return verified;

  const existing = store.findByService(service.id)[0];
  const id = existing?.id || store.uid();
  const { publicMeta, secrets } = store.splitFields(service, fields);
  const displayName = verified.displayName || store.displayFrom(service, { ...publicMeta, ...fields });

  store.upsertAccount({
    id,
    serviceId: service.id,
    displayName,
    status: "active",
    lastError: null,
    meta: publicMeta,
  });
  store.setSecrets(id, secrets);

  const connection = store.listPublic().find((c) => c.id === id);
  return { ok: true, connection, reused: Boolean(existing) };
}

async function ensureConnected(serviceId) {
  const service = getService(serviceId);
  if (!service) return { ok: false, error: "Unknown service" };
  const existing = store.findByService(service.id)[0];
  if (existing) {
    return { ok: true, connection: store.listPublic().find((c) => c.id === existing.id), reused: true };
  }
  return connectService({ serviceId: service.id, fields: {} });
}

async function disconnectService(args = {}) {
  const id = String(args.id || args.connectionId || "").trim();
  if (!id) return { ok: false, error: "Missing connection id" };
  store.removeAccount(id);
  return { ok: true, disconnected: id };
}

async function resolveOpen(args = {}) {
  const service = getService(args.serviceId);
  if (!service) return { ok: false, error: "Unknown service" };
    if (service.id === "myspace-browser") {
    const home = getMyspaceBrowserHome();
    return {
      ok: true,
      url: home.url,
      name: service.name,
      serviceId: service.id,
      color: service.color || null,
      howto: service.howto || "",
      kind: service.kind || "web",
      openMode: service.openMode || "shell",
      preload: home.preload,
      iconUrl: home.iconUrl,
    };
  }
  if (!service.openUrl) return { ok: false, error: "No in-app URL for this service" };
  return {
    ok: true,
    url: service.openUrl,
    name: service.name,
    serviceId: service.id,
    color: service.color || null,
    howto: service.howto || "",
    kind: service.kind || "web",
    openMode: service.openMode || "shell",
  };
}

async function openInShell(args = {}) {
  const resolved = await resolveOpen(args);
  if (!resolved.ok) return resolved;
  const url = String(args.url || resolved.url || "").trim();
  if (!url) return { ok: false, error: "No in-app URL for this service" };
  broadcastMailEvent("connect-open-web", {
    url,
    title: resolved.name,
    serviceId: resolved.serviceId,
    howto: resolved.howto,
    preload: resolved.preload || null,
    iconUrl: resolved.iconUrl || null,
  });
  return { ...resolved, url, opened: "shell" };
}

async function openOfficial(args = {}) {
  const resolved = await resolveOpen(args);
  if (!resolved.ok) return resolved;
  await shell.openExternal(resolved.url);
  return { ...resolved, opened: "external" };
}

module.exports = {
  catalog,
  listConnections,
  connectService,
  ensureConnected,
  disconnectService,
  openOfficial,
  openInShell,
  resolveOpen,
  verifyConnection,
  getMyspaceBrowserHome,
};