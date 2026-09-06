function unquoteArg(value) {
  const t = String(value || "").trim();
  if (
    (t.startsWith('"') && t.endsWith('"') && t.length >= 2) ||
    (t.startsWith("'") && t.endsWith("'") && t.length >= 2)
  ) {
    return t.slice(1, -1);
  }
  return t;
}

function splitArgList(raw) {
  const parts = [];
  let current = "";
  let quote = null;
  const s = String(raw || "");
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if ((ch === '"' || ch === "'") && !quote) {
      quote = ch;
      current += ch;
      continue;
    }
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === ",") {
      if (current.trim()) parts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseArgStructure(raw) {
  const parts = splitArgList(raw);
  const map = {};
  const positional = [];
  for (const part of parts) {
    const kv = part.match(/^([a-z_][a-z0-9_-]*)\s*:\s*(.+)$/i);
    if (kv) map[kv[1].toLowerCase()] = unquoteArg(kv[2]);
    else positional.push(unquoteArg(part));
  }
  return {
    map,
    positional,
    keys: Object.keys(map),
    single: parts.length === 1 ? unquoteArg(parts[0]) : null,
  };
}

function parseKvArgs(raw) {
  const input = {};
  for (const part of String(raw || "").trim().split(/\s+/).filter(Boolean)) {
    const m = part.match(/^([^:=]+)[:=]([\s\S]+)$/);
    if (m) input[m[1]] = m[2];
  }
  return input;
}

const api = { unquoteArg, splitArgList, parseArgStructure, parseKvArgs };
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.PartsShellArgs = api;
