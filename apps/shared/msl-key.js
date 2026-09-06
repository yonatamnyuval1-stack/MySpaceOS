(function (root) {
  const PREFIX = "msl:v1/";

  function encodeInput(input) {
    const params = new URLSearchParams();
    const obj = input && typeof input === "object" ? input : {};
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined || v === null || v === "") continue;
      if (typeof v === "object") params.set(k, JSON.stringify(v));
      else params.set(k, String(v));
    }
    const q = params.toString();
    return q ? `?${q}` : "";
  }

  function decodeInput(search) {
    const out = {};
    const params = new URLSearchParams(String(search || "").replace(/^\?/, ""));
    for (const [k, v] of params.entries()) {
      if ((v.startsWith("{") && v.endsWith("}")) || (v.startsWith("[") && v.endsWith("]"))) {
        try {
          out[k] = JSON.parse(v);
          continue;
        } catch {
        }
      }
      if (v === "true") out[k] = true;
      else if (v === "false") out[k] = false;
      else if (v !== "" && !Number.isNaN(Number(v)) && /^-?\d+(\.\d+)?$/.test(v)) out[k] = Number(v);
      else out[k] = v;
    }
    return out;
  }

  function build(capability, input) {
    const cap = String(capability || "").trim();
    if (!cap) throw new Error("Missing capability");
    return `${PREFIX}${cap}${encodeInput(input || {})}`;
  }

  function parse(uri) {
    const raw = String(uri || "").trim();
    if (!raw.toLowerCase().startsWith(PREFIX)) {
      return { ok: false, error: "Not an MSL key (expected msl:v1/...)" };
    }
    const rest = raw.slice(PREFIX.length);
    const qIdx = rest.indexOf("?");
    const capability = (qIdx >= 0 ? rest.slice(0, qIdx) : rest).trim();
    const search = qIdx >= 0 ? rest.slice(qIdx) : "";
    if (!capability) return { ok: false, error: "Missing capability in key" };
    return {
      ok: true,
      uri: raw,
      version: 1,
      capability,
      input: decodeInput(search),
    };
  }

  async function resolve(uri, invokeFn) {
    const parsed = parse(uri);
    if (!parsed.ok) return parsed;
    const invoke = invokeFn || root.Msl?.invoke;
    if (!invoke) return { ok: false, error: "MSL invoke unavailable" };
    try {
      const result = await invoke(parsed.capability, parsed.input);
      return { ok: true, ...parsed, result };
    } catch (err) {
      return { ok: false, error: err?.message || String(err), ...parsed };
    }
  }

  function previewLabel(entry) {
    if (entry?.label) return entry.label;
    const cap = entry?.capability || parse(entry?.uri || "")?.capability || "";
    const input = entry?.input || parse(entry?.uri || "")?.input || {};
    const hint =
      input.id ||
      input.code ||
      input.q ||
      input.query ||
      input.symbol ||
      input.title ||
      "";
    return hint ? `${cap} · ${hint}` : cap || "MSL key";
  }

  const api = { PREFIX, build, parse, resolve, previewLabel, encodeInput, decodeInput };
  root.MslKey = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
