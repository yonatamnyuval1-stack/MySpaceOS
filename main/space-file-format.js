const FORMAT_ID = "myspace.space";
const FORMAT_VERSION = 1;
const MAX_BYTES = 2 * 1024 * 1024;
const KINDS = Object.freeze(["script", "flow", "note", "deck"]);
const SECRET_KEY = /^(api[_-]?key|password|token|secret|authorization|auth)$/i;

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function clip(str, n) {
  return String(str || "").trim().slice(0, n);
}

function stripSecrets(value, depth = 0) {
  if (depth > 8 || value == null) return value;
  if (Array.isArray(value)) return value.map((v) => stripSecrets(v, depth + 1));
  if (!isPlainObject(value)) return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (SECRET_KEY.test(k)) continue;
    out[k] = stripSecrets(v, depth + 1);
  }
  return out;
}

function error(message) {
  return { ok: false, error: message };
}

function parseDocument(raw, opts = {}) {
  const max = Number(opts.maxBytes) > 0 ? Number(opts.maxBytes) : MAX_BYTES;
  if (typeof raw !== "string") return error("File must be UTF-8 text");
  if (Buffer.byteLength(raw, "utf8") > max) {
    return error(`File is too large (max ${Math.round(max / 1024)} KB)`);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return error("Not a valid .space file (invalid JSON)");
  }
  if (!isPlainObject(data)) return error("Not a valid .space file");
  if (data.format !== FORMAT_ID) {
    return error('Not a My Space file (missing format "myspace.space")');
  }
  const version = Number(data.version);
  if (!Number.isInteger(version) || version < 1) {
    return error("Unsupported .space version");
  }
  if (version > FORMAT_VERSION) {
    return error(`This .space file needs a newer My Space (version ${version})`);
  }
  const kind = String(data.kind || "").toLowerCase().trim();
  if (!KINDS.includes(kind)) {
    return error(`Unknown .space kind "${kind || ""}". Expected: ${KINDS.join(", ")}`);
  }
  if (!isPlainObject(data.payload)) return error("Missing payload");

  const title = clip(data.title || suggestTitle(kind, data.payload), 80) || "Untitled";
  const payload = normalizePayload(kind, data.payload);
  if (!payload.ok) return payload;

  return {
    ok: true,
    doc: {
      format: FORMAT_ID,
      version: FORMAT_VERSION,
      kind,
      title,
      exportedAt: data.exportedAt || null,
      payload: payload.payload,
    },
  };
}

function suggestTitle(kind, payload) {
  if (!isPlainObject(payload)) return "Untitled";
  if (kind === "script") return payload.name || "script";
  if (kind === "flow") return payload.title || payload.task || "flow";
  if (kind === "note") return payload.title || "note";
  if (kind === "deck") return payload.name || "deck";
  return "Untitled";
}

function normalizePayload(kind, raw) {
  if (kind === "script") {
    const name = clip(raw.name, 80) || "untitled";
    const body = String(raw.body ?? "");
    if (!body.trim()) return error("Script payload is empty");
    return { ok: true, payload: { name, body } };
  }
  if (kind === "flow") {
    const steps = Array.isArray(raw.steps) ? raw.steps : [];
    if (!steps.length) return error("Flow payload has no steps");
    const cleanSteps = steps.slice(0, 12).map((step, i) => {
      const s = isPlainObject(step) ? step : {};
      return {
        id: clip(s.id, 64) || `step_${i + 1}`,
        tool: clip(s.tool, 80),
        label: clip(s.label, 120),
        description: String(s.description || "").slice(0, 2000),
        config: stripSecrets(isPlainObject(s.config) ? s.config : {}),
        chips: Array.isArray(s.chips) ? s.chips.slice(0, 24).map((c) => String(c).slice(0, 80)) : [],
        order: Number.isFinite(Number(s.order)) ? Number(s.order) : i,
      };
    });
    return {
      ok: true,
      payload: {
        title: clip(raw.title, 80) || "Untitled flow",
        task: String(raw.task || "").slice(0, 500),
        summary: String(raw.summary || "").slice(0, 2000),
        source: clip(raw.source, 40) || "studio",
        steps: cleanSteps,
      },
    };
  }
  if (kind === "note") {
    const title = clip(raw.title, 200) || "Untitled";
    const body = String(raw.body || "");
    if (!title && !body.trim()) return error("Note payload is empty");
    const tags = Array.isArray(raw.tags)
      ? [...new Set(raw.tags.map((t) => clip(String(t).replace(/^#/, ""), 40).toLowerCase()).filter(Boolean))].slice(
          0,
          20
        )
      : [];
    return { ok: true, payload: { title, body, tags } };
  }
  if (kind === "deck") {
    const name = clip(raw.name, 80) || "Imported deck";
    const cards = (Array.isArray(raw.cards) ? raw.cards : [])
      .slice(0, 400)
      .map((c) => {
        if (!isPlainObject(c)) return null;
        return {
          type: clip(c.type || "flash", 20),
          front: String(c.front || c.prompt || "").slice(0, 4000),
          back: String(c.back || c.answer || "").slice(0, 4000),
          choices: Array.isArray(c.choices) ? c.choices.map((x) => String(x).slice(0, 400)).slice(0, 8) : [],
          answerIndex: Number.isFinite(Number(c.answerIndex)) ? Number(c.answerIndex) : -1,
          explanation: String(c.explanation || "").slice(0, 2000),
        };
      })
      .filter((c) => c && (c.front.trim() || c.back.trim()));
    return {
      ok: true,
      payload: {
        name,
        description: String(raw.description || "").slice(0, 500),
        color: clip(raw.color, 20) || "#1f6f5b",
        language: String(raw.language || "en").toLowerCase().startsWith("he") ? "he" : "en",
        cards,
      },
    };
  }
  return error("Unknown kind");
}

function buildDocument({ kind, title, payload }) {
  const k = String(kind || "").toLowerCase().trim();
  if (!KINDS.includes(k)) return error(`Unknown kind "${kind}"`);
  const normalized = normalizePayload(k, payload || {});
  if (!normalized.ok) return normalized;
  const doc = {
    format: FORMAT_ID,
    version: FORMAT_VERSION,
    kind: k,
    title: clip(title || suggestTitle(k, normalized.payload), 80) || "Untitled",
    exportedAt: new Date().toISOString(),
    payload: normalized.payload,
  };
  return { ok: true, doc, text: `${JSON.stringify(doc, null, 2)}\n` };
}

function looksLikeSpacePath(raw) {
  const t = String(raw || "")
    .trim()
    .replace(/^["']+|["']+$/g, "");
  return /\.space$/i.test(t);
}

function sanitizeFileStem(title) {
  const stem = clip(title, 60)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .trim() || "document";
  return stem.replace(/\.+$/, "") || "document";
}

module.exports = {
  FORMAT_ID,
  FORMAT_VERSION,
  MAX_BYTES,
  KINDS,
  parseDocument,
  buildDocument,
  looksLikeSpacePath,
  sanitizeFileStem,
  stripSecrets,
};