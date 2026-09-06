const IDENT_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function splitCommandChain(line) {
  const parts = [];
  let current = "";
  let depth = 0;
  let brace = 0;
  let quote = null;
  const src = String(line || "");
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
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
    if (ch === "(") depth += 1;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "{") brace += 1;
    if (ch === "}") brace = Math.max(0, brace - 1);
    if ((ch === ";" || ch === "|") && depth === 0 && brace === 0) {
      if (current.trim()) {
        parts.push({ text: current.trim(), keepGoing: ch === "|" });
      }
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push({ text: current.trim(), keepGoing: false });
  return parts;
}

function parseArgList(inner) {
  const src = String(inner || "");
  if (!src.trim()) return [];
  const args = [];
  let cur = "";
  let quote = null;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === ",") {
      args.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  args.push(cur.trim());
  return args;
}

function parseFnParams(paramStr) {
  return String(paramStr || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((p) => (IDENT_RE.test(p) ? p : null));
}

function countBracesOutsideQuotes(text) {
  let depth = 0;
  let quote = null;
  const src = String(text || "");
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if ((ch === '"' || ch === "'") && !quote) {
      quote = ch;
      continue;
    }
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
  }
  return depth;
}

function extractBalancedBlock(text, openIdx) {
  let depth = 0;
  let quote = null;
  for (let i = openIdx; i < text.length; i += 1) {
    const ch = text[i];
    if ((ch === '"' || ch === "'") && !quote) {
      quote = ch;
      continue;
    }
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return { body: text.slice(openIdx + 1, i), end: i };
    }
  }
  return null;
}

function parseProgram(body) {
  const rawLines = String(body || "").split(/\r?\n/);
  const stmts = [];
  let i = 0;
  while (i < rawLines.length) {
    const trimmed = rawLines[i].trim();
    if (!trimmed || trimmed.startsWith("#")) {
      i += 1;
      continue;
    }

    if (/^fn\s+/i.test(trimmed) && trimmed.includes("{")) {
      let collected = trimmed;
      let j = i;
      const openAt = collected.indexOf("{");
      if (openAt < 0) {
        return { ok: false, error: `Function missing "{": ${trimmed}` };
      }
      let depth = countBracesOutsideQuotes(collected);
      while (depth > 0) {
        j += 1;
        if (j >= rawLines.length) {
          return { ok: false, error: `Unclosed function body near: ${trimmed}` };
        }
        collected += `\n${rawLines[j]}`;
        depth = countBracesOutsideQuotes(collected);
      }
      const fnMatch = collected.match(
        /^fn\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*\{([\s\S]*)\}\s*$/i
      );
      if (!fnMatch) {
        return { ok: false, error: `Invalid function syntax near line ${i + 1}` };
      }
      const params = parseFnParams(fnMatch[2]);
      if (params.some((p) => !p)) {
        return { ok: false, error: `Invalid function parameters: ${fnMatch[2]}` };
      }
      stmts.push({
        type: "fn",
        name: fnMatch[1],
        params,
        body: fnMatch[3].replace(/^\n/, "").replace(/\n$/, ""),
      });
      i = j + 1;
      continue;
    }

    stmts.push({ type: "line", text: trimmed });
    i += 1;
  }
  return { ok: true, stmts };
}

function parseFnCall(line) {
  const trimmed = String(line || "").trim();
  const open = trimmed.indexOf("(");
  if (open <= 0 || !trimmed.endsWith(")")) return null;
  const name = trimmed.slice(0, open).trim();
  if (!IDENT_RE.test(name)) return null;
  if (/\s/.test(name)) return null;
  const inner = trimmed.slice(open + 1, -1);
  return { name, args: parseArgList(inner) };
}

function parseScriptLines(body) {
  return String(body || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

const api = {
  IDENT_RE,
  splitCommandChain,
  parseArgList,
  parseFnParams,
  countBracesOutsideQuotes,
  extractBalancedBlock,
  parseProgram,
  parseFnCall,
  parseScriptLines,
};

if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.PartsShellProgram = api;