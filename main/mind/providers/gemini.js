const { reportRuntimeFailure } = require("../../resolve/report-helper");

/** Gemini default-style thresholds (do not disable sexually-explicit filtering). */
const SAFETY_DEFAULT = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
];

async function postGenerate(url, key, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify(body),
  });
  const rawText = await res.text();
  let data = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = { raw: rawText };
  }
  return { res, data };
}

function errMsg(data, status) {
  return String(data?.error?.message || data?.message || `HTTP ${status}`);
}

function summarizeRatings(ratings) {
  if (!Array.isArray(ratings) || !ratings.length) return "";
  return ratings
    .filter((r) => /MEDIUM|HIGH|HARM/i.test(String(r?.probability || r?.severity || "")))
    .map((r) => `${r.category || "?"}:${r.probability || r?.severity || "?"}`)
    .slice(0, 6)
    .join(", ");
}

function detectApiBlock(data) {
  const feedback = data?.promptFeedback;
  if (feedback?.blockReason) {
    return {
      blocked: true,
      kind: "prompt",
      reason: String(feedback.blockReason),
      detail: summarizeRatings(feedback.safetyRatings),
    };
  }

  const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
  if (!candidates.length && data && !data.error) {
    return {
      blocked: true,
      kind: "empty",
      reason: feedback?.blockReason || "NO_CANDIDATES",
      detail: summarizeRatings(feedback?.safetyRatings),
    };
  }

  const candidate = candidates[0];
  if (!candidate) return { blocked: false };

  const finish = String(candidate.finishReason || "");
  if (/SAFETY|BLOCKLIST|PROHIBITED|RECITATION|SPII/i.test(finish)) {
    return {
      blocked: true,
      kind: "candidate",
      reason: finish,
      detail: summarizeRatings(candidate.safetyRatings),
    };
  }

  const parts = candidate.content?.parts || [];
  const text = parts
    .map((p) => (typeof p?.text === "string" ? p.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();

  if (!text && finish) {
    return {
      blocked: true,
      kind: "candidate",
      reason: finish || "EMPTY_AFTER_FILTER",
      detail: summarizeRatings(candidate.safetyRatings),
    };
  }
  return { blocked: false, candidate, text, finish };
}

function mergeSystem(system) {
  return String(system || "").trim();
}

function buildBodyBase({ prompt, messages, system, temperature, maxOutputTokens, seedAssistant }) {
  let contents = [];

  if (Array.isArray(messages) && messages.length) {
    for (const m of messages) {
      const roleRaw = String(m?.role || "").toLowerCase();
      const role = roleRaw === "assistant" || roleRaw === "model" ? "model" : "user";
      const text = String(m?.content ?? m?.text ?? "").trim();
      if (!text) continue;
      if (contents.length && contents[contents.length - 1].role === role) {
        contents[contents.length - 1].parts[0].text += `\n\n${text}`;
      } else {
        contents.push({ role, parts: [{ text }] });
      }
    }
    if (contents.length && contents[0].role === "model") {
      contents.unshift({ role: "user", parts: [{ text: "(continue)" }] });
    }
  }

  if (!contents.length) {
    contents = [
      {
        role: "user",
        parts: [{ text: String(prompt || "") }],
      },
    ];
  }

  const seed = String(seedAssistant || "").trim();
  if (seed) {
    if (!contents.length || contents[contents.length - 1].role !== "user") {
      contents.push({ role: "user", parts: [{ text: "(continue)" }] });
    }
    contents.push({
      role: "model",
      parts: [{ text: seed }],
    });
  }

  const body = {
    contents,
    generationConfig: {
      temperature: temperature ?? 0.5,
      maxOutputTokens: maxOutputTokens ?? 2048,
    },
    safetySettings: SAFETY_DEFAULT.slice(),
  };

  const sys = mergeSystem(system);
  if (sys) {
    body.systemInstruction = { parts: [{ text: sys }] };
  }

  return body;
}

async function generateOnce(url, key, bodyBase) {
  const body = { ...bodyBase, safetySettings: (bodyBase.safetySettings || SAFETY_DEFAULT).slice() };
  let res;
  let data;
  try {
    ({ res, data } = await postGenerate(url, key, body));
  } catch (err) {
    reportRuntimeFailure("mind", "GEMINI_NETWORK_ERROR", err, {
      provider: "gemini",
      url,
    });
    return { ok: false, error: `Gemini network error: ${err?.message || err}` };
  }

  const usedSafety = body.safetySettings?.[0]?.threshold || "?";

  if (!res.ok) {
    const lastHttpError = errMsg(data, res.status);
    reportRuntimeFailure("mind", "GEMINI_HTTP_ERROR", new Error(lastHttpError), {
      provider: "gemini",
      status: res.status,
      url,
    });
    return { ok: false, error: lastHttpError, status: res.status };
  }

  const block = detectApiBlock(data);
  if (block.blocked) {
    const bits = [
      `Gemini API blocked (${block.kind}: ${block.reason})`,
      `safety threshold sent: ${usedSafety}`,
    ];
    if (block.detail) bits.push(block.detail);
    return {
      ok: false,
      error: bits.join(" · "),
      finishReason: block.reason,
      blockKind: block.kind,
      safetyThreshold: usedSafety,
    };
  }

  return {
    ok: true,
    text: block.text || "",
    finishReason: block.finish || "",
    safetyThreshold: usedSafety,
    usage: data?.usageMetadata || {},
    tokens:
      Number(data?.usageMetadata?.totalTokenCount) ||
      Number(data?.usageMetadata?.promptTokenCount || 0) +
        Number(data?.usageMetadata?.candidatesTokenCount || 0) ||
      0,
  };
}

async function generate({
  apiKey,
  model,
  baseUrl,
  prompt,
  messages,
  system,
  temperature,
  maxOutputTokens,
  seedAssistant,
}) {
  const key = String(apiKey || "").trim();
  if (!key) return { ok: false, error: "Gemini API key missing" };
  const mdl = String(model || "gemini-2.5-flash").trim();
  const base = String(baseUrl || "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
  const url = `${base}/models/${encodeURIComponent(mdl)}:generateContent`;

  const hasMessages = Array.isArray(messages) && messages.length > 0;
  const hasPrompt = Boolean(String(prompt || "").trim());
  if (!hasMessages && !hasPrompt) return { ok: false, error: "Missing prompt" };

  const bodyBase = buildBodyBase({
    prompt,
    messages,
    system,
    temperature,
    maxOutputTokens,
    seedAssistant,
  });

  const result = await generateOnce(url, key, bodyBase);
  if (!result.ok) {
    return { ...result, model: mdl, provider: "gemini" };
  }

  const tokens =
    result.tokens ||
    Math.ceil((String(prompt || "").length + String(result.text || "").length) / 4);

  return {
    ok: true,
    text: result.text,
    model: mdl,
    provider: "gemini",
    finishReason: result.finishReason || "",
    tokens,
    usage: result.usage || {},
    safetyThreshold: result.safetyThreshold,
  };
}

async function listModels({ apiKey, baseUrl }) {
  const key = String(apiKey || "").trim();
  if (!key) return { ok: false, error: "Gemini API key missing", models: [] };
  const base = String(baseUrl || "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/models`, {
      headers: { "x-goog-api-key": key },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      reportRuntimeFailure("mind", "GEMINI_MODELS_HTTP_ERROR", new Error(data?.error?.message || `HTTP ${res.status}`), {
        provider: "gemini",
        status: res.status,
      });
      return { ok: false, error: data?.error?.message || `HTTP ${res.status}`, models: [] };
    }
    const models = (data.models || [])
      .map((m) => String(m.name || "").replace(/^models\//, ""))
      .filter((id) => /gemini/i.test(id))
      .slice(0, 40);
    return { ok: true, models };
  } catch (err) {
    reportRuntimeFailure("mind", "GEMINI_MODELS_NETWORK_ERROR", err, { provider: "gemini" });
    return { ok: false, error: err?.message || String(err), models: [] };
  }
}

module.exports = {
  generate,
  listModels,
  SAFETY_DEFAULT,
};
