const { reportRuntimeFailure } = require("../../resolve/report-helper");

async function generate({ baseUrl, model, prompt, system, temperature }) {
  const base = String(baseUrl || "http://127.0.0.1:11434").replace(/\/$/, "");
  const mdl = String(model || "llama3.2").trim();
  const messages = [];
  if (system) messages.push({ role: "system", content: String(system) });
  messages.push({ role: "user", content: String(prompt || "") });

  let res;
  try {
    res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: mdl,
        messages,
        stream: false,
        options: { temperature: temperature ?? 0.5 },
      }),
    });
  } catch (err) {
    reportRuntimeFailure("mind", "OLLAMA_UNAVAILABLE", err, {
      provider: "ollama",
      base,
    });
    return {
      ok: false,
      error: `Ollama unavailable (${err?.message || err}). Start Ollama locally to use GPU/CPU models.`,
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
    const res = await fetch(`${base}/api/tags`);
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
    reportRuntimeFailure("mind", "OLLAMA_PING_FAILED", err, {
      provider: "ollama",
      base,
    });
    return { ok: false, error: err?.message || String(err), models: [] };
  }
}

module.exports = { generate, ping };