const fs = require("fs");
const path = require("path");

const GEMINI_MODEL = process.env.WM_GEMINI_MODEL || "gemini-flash-lite-latest";
const GEMINI_BASE =
  process.env.WM_GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";

function resolveGeminiApiKey() {
  const fromEnv = String(process.env.WM_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "").trim();
  if (fromEnv) return fromEnv;

  const bootCandidates = [];
  try {
    const { app } = require("electron");
    if (app && typeof app.getAppPath === "function") {
      bootCandidates.push(path.join(app.getAppPath(), "config", "mind-bootstrap.local.json"));
    }
  } catch {
    /* standalone / tests without electron */
  }
  bootCandidates.push(path.join(__dirname, "..", "config", "mind-bootstrap.local.json"));

  for (const bootPath of bootCandidates) {
    try {
      if (!fs.existsSync(bootPath)) continue;
      const raw = JSON.parse(fs.readFileSync(bootPath, "utf8"));
      const key = String(raw.geminiApiKey || raw.GEMINI_API_KEY || "").trim();
      if (key) return key;
    } catch {
      /* ignore bad bootstrap */
    }
  }

  try {
    const mindStore = require(path.join(__dirname, "..", "main", "mind", "store.js"));
    const key = String(mindStore.getProviderSecret?.("gemini") || "").trim();
    if (key) return key;
  } catch {
    /* mind store unavailable */
  }

  return "";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientFetchError(err) {
  const msg = String(err?.message || err || "").toLowerCase();
  const code = String(err?.cause?.code || err?.code || "").toUpperCase();
  return (
    msg.includes("fetch failed") ||
    msg.includes("network") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("enotfound") ||
    msg.includes("socket") ||
    ["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT"].includes(
      code
    )
  );
}

async function geminiGenerateOnce(payload = {}) {
  const contents = Array.isArray(payload.contents) ? payload.contents : [];
  if (!contents.length) {
    return { ok: false, error: "Empty contents" };
  }

  const apiKey = resolveGeminiApiKey();
  if (!apiKey) {
    return {
      ok: false,
      error:
        "Gemini API key not configured. Set WM_GEMINI_API_KEY / GEMINI_API_KEY, or add geminiApiKey to config/mind-bootstrap.local.json",
    };
  }

  const body = {
    contents,
    generationConfig: {
      temperature: payload.temperature ?? 0.4,
      maxOutputTokens: payload.maxOutputTokens ?? 2048,
    },
  };
  if (payload.responseMimeType) {
    body.generationConfig.responseMimeType = payload.responseMimeType;
  }
  if (payload.responseSchema) {
    body.generationConfig.responseSchema = payload.responseSchema;
  }

  if (payload.systemInstruction) {
    body.systemInstruction =
      typeof payload.systemInstruction === "string"
        ? { parts: [{ text: payload.systemInstruction }] }
        : payload.systemInstruction;
  }

  if (payload.tools) body.tools = payload.tools;
  if (payload.toolConfig) body.toolConfig = payload.toolConfig;

  const url = `${GEMINI_BASE.replace(/\/$/, "")}/models/${GEMINI_MODEL}:generateContent`;
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const detail = err?.cause?.message || err?.message || String(err);
    const error = new Error(`Gemini network error: ${detail}`);
    error.code = err?.cause?.code || err?.code;
    error.cause = err;
    throw error;
  }

  const rawText = await res.text();
  let data = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = { raw: rawText };
  }

  if (!res.ok) {
    const msg =
      data?.error?.message ||
      data?.message ||
      data?.error ||
      `HTTP ${res.status}`;
    return {
      ok: false,
      error: typeof msg === "string" ? msg : JSON.stringify(msg),
      status: res.status,
    };
  }

  const candidate = data?.candidates?.[0] || null;
  const parts = candidate?.content?.parts || [];
  const text = parts
    .map((p) => (typeof p?.text === "string" ? p.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
  return {
    ok: true,
    candidate,
    parts,
    text,
    finishReason: candidate?.finishReason || "",
    model: GEMINI_MODEL,
    data,
  };
}

async function geminiGenerate(payload = {}) {
  const attempts = Math.max(1, Math.min(5, Number(payload.retries) || 3));
  let lastErr = null;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await geminiGenerateOnce(payload);
    } catch (err) {
      lastErr = err;
      if (!isTransientFetchError(err) || i === attempts - 1) {
        return { ok: false, error: err?.message || String(err) };
      }
      await sleep(400 * Math.pow(2, i));
    }
  }
  return { ok: false, error: lastErr?.message || "Gemini request failed" };
}

function registerGeminiIpc(ipcMain) {
  ipcMain.handle("gemini-generate", async (_event, payload) => {
    try {
      return await geminiGenerate(payload || {});
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("gemini-chat", async (_event, messages) => {
    try {
      const contents = [];
      for (const m of Array.isArray(messages) ? messages.slice(-8) : []) {
        const roleRaw = String(m?.role || "").toLowerCase();
        const role = roleRaw === "assistant" || roleRaw === "model" ? "model" : roleRaw === "user" ? "user" : null;
        if (!role) continue;
        const text = String(m?.content || "").trim();
        if (!text) continue;
        contents.push({ role, parts: [{ text }] });
      }
      const res = await geminiGenerate({ contents });
      if (!res.ok) return res;
      const parts = res.candidate?.content?.parts || [];
      const content = parts
        .map((p) => (typeof p?.text === "string" ? p.text : ""))
        .filter(Boolean)
        .join("\n")
        .trim();
      if (!content) return { ok: false, error: "Empty response from Gemini" };
      return { ok: true, content, model: res.model };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });
}

module.exports = { registerGeminiIpc, geminiGenerate };