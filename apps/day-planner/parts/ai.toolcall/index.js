const TOOL_CALL_RE = /TOOL_CALL\s*:\s*(\{[\s\S]*?\})\s*(?:TOOL_CALL_END|$)/i;

function parseToolCall(text) {
  const raw = String(text || "");
  const m = raw.match(TOOL_CALL_RE);
  if (!m) return null;
  try {
    const parsed = JSON.parse(m[1].trim());
    const name = String(parsed?.name || parsed?.tool || "").trim();
    if (!name) return null;

    let arguments_ = {};
    if (parsed.arguments != null) {
      if (typeof parsed.arguments === "string") {
        const s = parsed.arguments.trim();
        try {
          const asJson = JSON.parse(s);
          arguments_ = typeof asJson === "object" && asJson ? asJson : { app: s };
        } catch {
          arguments_ = { app: s, value: s };
        }
      } else if (typeof parsed.arguments === "object") {
        arguments_ = { ...parsed.arguments };
      }
    }
    for (const key of [
      "app",
      "appId",
      "app_name",
      "page",
      "place",
      "x",
      "y",
      "title",
      "minutes",
      "maxChars",
      "max_chars",
    ]) {
      if (parsed[key] != null && arguments_[key] == null) {
        arguments_[key] = parsed[key];
      }
    }

    return { name, arguments: arguments_, rawBlock: m[0] };
  } catch {
    return null;
  }
}

function parseNativeToolCalls(message) {
  const calls = message?.tool_calls;
  if (!Array.isArray(calls) || !calls.length) return null;
  const first = calls[0];
  const name = String(first?.function?.name || first?.name || "").trim();
  if (!name) return null;
  let arguments_ = {};
  const rawArgs = first?.function?.arguments ?? first?.arguments;
  if (typeof rawArgs === "string" && rawArgs.trim()) {
    try {
      arguments_ = JSON.parse(rawArgs);
    } catch {
      arguments_ = { value: rawArgs };
    }
  } else if (rawArgs && typeof rawArgs === "object") {
    arguments_ = { ...rawArgs };
  }
  return { name, arguments: arguments_, rawBlock: null };
}

function stripToolCall(text) {
  return String(text || "").replace(TOOL_CALL_RE, "").trim();
}

function sanitizeToolResultForTrace(result) {
  if (!result || typeof result !== "object") return result;
  if (!result.screenshotDataUrl && !result.dataUrl && !result.screenshotImages) return result;
  const { screenshotDataUrl, dataUrl, screenshotImages, ...rest } = result;
  return {
    ...rest,
    screenshotAttached: true,
    screenshotBytes: result.bytes || undefined,
    imageCount: screenshotImages?.length || (screenshotDataUrl || dataUrl ? 1 : undefined),
  };
}

const api = {
  TOOL_CALL_RE,
  parseToolCall,
  parseNativeToolCalls,
  stripToolCall,
  sanitizeToolResultForTrace,
};

if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.PartsAiToolcall = api;