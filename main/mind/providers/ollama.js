const { reportRuntimeFailure } = require("../../resolve/report-helper");

function friendlyOllamaError(err, { base, action } = {}) {
  const raw = String(err?.message || err || "Ollama offline");
  const host = String(base || "http://127.0.0.1:11434").replace(/\/$/, "");
  if (/econnrefused|fetch failed|enotfound|econnreset|etimedout|network|aborted|timed out/i.test(raw)) {
    return (
      `Ollama isn’t running at ${host}. ` +
      "Start Ollama on this PC, or turn off local Ollama in Mind → Setup and use a Gemini key instead. " +
      `(${raw})`
    );
  }
  if (action === "ping") {
    return `Ollama not reachable at ${host}: ${raw}`;
  }
  return raw;
}

async function generate({ baseUrl, model, prompt, system, temperature }) {
  const base = String(baseUrl || "http://127.0.0.1:11434").replace(/\/$/, "");
  const mdl = String(model || "llama3.2").trim();
  const messages = [];
  if (system) messages.push({ role: "system", content: String(system) });
  messages.push({ role: "user", content: String(prompt || "") });

  let res;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      res = await fetch(`${base}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: mdl,
          messages,
          stream: false,
          options: { temperature: temperature ?? 0.5 },
        }),
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    const message =
      err?.name === "AbortError"
        ? friendlyOllamaError(new Error("timed out after 20s"), { base, action: "generate" })
        : friendlyOllamaError(err, { base, action: "generate" });
    reportRuntimeFailure("mind", "OLLAMA_UNAVAILABLE", err, {
      provider: "ollama",
      base,
    });
    return {
      ok: false,
      error: message,
    };
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    reportRuntimeFailure("mind", "OLLAMA_HTTP_ERROR", new Error(data?.error || `HTTP ${res.status}`), {
      provider: "ollama",
      status: res.status,
      base,
    });
    return { ok: false, error: data?.error || `HTTP ${res.status}` };
  }
  const text = String(data?.message?.content || data?.response || "").trim();
  const tokens = Math.ceil((String(prompt || "").length + text.length) / 4);
  return {
    ok: true,
    text,
    model: mdl,
    provider: "ollama",
    tokens,
  };
}

async function ping(baseUrl) {
  const base = String(baseUrl || "http://127.0.0.1:11434").replace(/\/$/, "");
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    let res;
    try {
      res = await fetch(`${base}/api/tags`, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      reportRuntimeFailure("mind", "OLLAMA_PING_HTTP_ERROR", new Error(`HTTP ${res.status}`), {
        provider: "ollama",
        status: res.status,
        base,
      });
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const data = await res.json().catch(() => ({}));
    const models = (data.models || []).map((m) => m.name).filter(Boolean);
    return { ok: true, models };
  } catch (err) {
    const message =
      err?.name === "AbortError"
        ? friendlyOllamaError(new Error("timed out after 8s"), { base, action: "ping" })
        : friendlyOllamaError(err, { base, action: "ping" });
    reportRuntimeFailure("mind", "OLLAMA_PING_FAILED", err, {
      provider: "ollama",
      base,
    });
    return { ok: false, error: message, models: [] };
  }
}

module.exports = { generate, ping, friendlyOllamaError };
