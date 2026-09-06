function slimValue(value, depth = 0) {
  if (value == null) return value;
  if (depth > 3) return undefined;
  if (typeof value === "string") return value.slice(0, 400);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 24).map((item) => slimValue(item, depth + 1)).filter((v) => v !== undefined);
  }
  if (typeof value === "object") {
    const out = {};
    const prefer = [
      "id",
      "name",
      "title",
      "era",
      "year",
      "type",
      "category",
      "summary",
      "blurb",
      "description",
      "code",
      "symbol",
      "price",
      "translated",
      "text",
      "figures",
      "events",
      "items",
      "body",
      "entity",
      "country",
      "quote",
      "project",
      "doc",
    ];
    const keys = [
      ...prefer.filter((k) => Object.prototype.hasOwnProperty.call(value, k)),
      ...Object.keys(value).filter((k) => !prefer.includes(k)).slice(0, 8),
    ];
    for (const k of keys.slice(0, 14)) {
      if (k === "ok" || k === "error" || k === "handler") continue;
      const v = slimValue(value[k], depth + 1);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  return undefined;
}

function formatSourceBlock(sources, appLabel = "this app") {
  if (!sources.length) return "";
  const chunks = sources.map((s, i) => {
    const head = `${i + 1}. ${s.label || s.capability} [${s.capability}] ${s.uri}`;
    let body = "";
    try {
      body = JSON.stringify(s.data, null, 0);
    } catch {
      body = String(s.data || "");
    }
    if (body.length > 3500) body = body.slice(0, 3500) + "…";
    return `${head}\n${body}`;
  });
  return (
    `\n\nMy Space Link sources injected for ${appLabel} (treat as tools / factual grounding for your AI work).\n` +
    `Use concrete names, facts, and examples from these sources when relevant.\n` +
    `Do not paste raw JSON into user-facing output.\n` +
    `Sources:\n${chunks.join("\n\n")}`
  );
}

async function gatherMslAiContext(appId, opts = {}) {
  const id = String(appId || "").trim();
  if (!id) return { ok: true, sources: [], promptBlock: "", count: 0 };

  const registry = require("./registry");
  const { handleMslInvoke } = require("./broker");

  const listed = registry.listInjections({ appId: id });
  const keys = Array.isArray(listed?.keys) ? listed.keys.slice(0, 12) : [];
  if (!keys.length) {
    return { ok: true, sources: [], promptBlock: "", count: 0 };
  }

  const sources = [];
  for (const key of keys) {
    try {
      const resolved = await handleMslInvoke(id, "msl.key.resolve", { uri: key.uri });
      const result = resolved?.result;
      const data =
        result && result.ok !== false
          ? slimValue(result)
          : { error: result?.error || resolved?.error || "resolve failed" };
      sources.push({
        id: key.id,
        uri: key.uri,
        label: key.label || key.capability,
        capability: key.capability || resolved?.capability || "",
        data,
      });
    } catch (err) {
      sources.push({
        id: key.id,
        uri: key.uri,
        label: key.label || key.capability,
        capability: key.capability || "",
        data: { error: err?.message || String(err) },
      });
    }
  }

  const label = opts.label || id;
  return {
    ok: true,
    sources,
    count: sources.length,
    promptBlock: formatSourceBlock(sources, label),
  };
}

module.exports = { gatherMslAiContext, formatSourceBlock, slimValue };