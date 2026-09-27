const fs = require("fs");
const path = require("path");

const filePath =
  process.argv[2] || path.join(process.env.APPDATA || "", "my-space", "builds.json");

function tryParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function salvageJson(text) {
  let inString = false;
  let escape = false;
  const stack = [];
  let lastGood = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{" || ch === "[") {
      stack.push(ch === "{" ? "}" : "]");
      lastGood = i;
      continue;
    }
    if (ch === "}" || ch === "]") {
      if (stack.length && stack[stack.length - 1] === ch) {
        stack.pop();
        lastGood = i;
      }
    }
  }

  let cut = text;
  if (inString) {
    let j = text.length - 1;
    for (let k = text.length - 1; k >= 0; k--) {
      const c = text[k];
      if (c === "," || c === "[" || c === "{") {
        cut = text.slice(0, k + (c === "," ? 0 : 1));
        return salvageJson(cut);
      }
    }
  }

  let base = cut.slice(0, lastGood + 1);
  inString = false;
  escape = false;
  const st = [];
  for (let i = 0; i < base.length; i++) {
    const ch = base[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{" || ch === "[") st.push(ch === "{" ? "}" : "]");
    else if (ch === "}" || ch === "]") {
      if (st.length && st[st.length - 1] === ch) st.pop();
    }
  }

  let out = base;
  out = out.replace(/,\s*$/, "");
  while (st.length) out += st.pop();
  const parsed = tryParse(out);
  if (parsed) return { ok: true, data: parsed, method: "brace-close" };

  return extractProjectsFallback(text);
}

function extractProjectsFallback(text) {
  const projectsIdx = text.indexOf('"projects"');
  if (projectsIdx < 0) return { ok: false, error: "No projects key" };
  const arrStart = text.indexOf("[", projectsIdx);
  if (arrStart < 0) return { ok: false, error: "No projects array" };

  const projects = [];
  let i = arrStart + 1;
  while (i < text.length) {
    while (i < text.length && /[\s,]/.test(text[i])) i++;
    if (text[i] === "]") break;
    if (text[i] !== "{") break;
    let depth = 0;
    let inString = false;
    let escape = false;
    const start = i;
    let end = -1;
    for (; i < text.length; i++) {
      const ch = text[i];
      if (inString) {
        if (escape) {
          escape = false;
          continue;
        }
        if (ch === "\\") {
          escape = true;
          continue;
        }
        if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          i++;
          break;
        }
      }
    }
    if (end < 0) break; 
    const slice = text.slice(start, end + 1);
    const obj = tryParse(slice);
    if (obj && obj.name) projects.push(obj);
  }

  let categories = [];
  const catIdx = text.indexOf('"categories"');
  if (catIdx >= 0) {
    const cStart = text.indexOf("[", catIdx);
    const cEnd = text.indexOf("]", cStart);
    if (cStart >= 0 && cEnd > cStart) {
      const cats = tryParse(text.slice(cStart, cEnd + 1));
      if (Array.isArray(cats)) categories = cats;
    }
  }

  return {
    ok: true,
    data: { categories, projects, settings: { seeded: true } },
    method: "object-extract",
  };
}

function slimFileTree(tree) {
  if (!tree || typeof tree !== "object") return tree;
  return {
    ...tree,
    children: Array.isArray(tree.children)
      ? tree.children.map((n) => slimNode(n, 0)).filter(Boolean)
      : [],
  };
}

function slimNode(node, depth) {
  if (!node || typeof node !== "object") return null;
  const out = {
    name: node.name,
    path: node.path,
    type: node.type,
  };
  if (node.type === "file") {
    out.size = node.size;
    out.sizeLabel = node.sizeLabel;
    out.ext = node.ext;
    return out;
  }
  if (depth >= 2) {
    out.children = [];
    out.truncated = true;
    return out;
  }
  out.children = Array.isArray(node.children)
    ? node.children.map((c) => slimNode(c, depth + 1)).filter(Boolean)
    : [];
  return out;
}

function main() {
  if (!fs.existsSync(filePath)) {
    console.error("Missing", filePath);
    process.exit(1);
  }
  const raw = fs.readFileSync(filePath, "utf8");
  console.log("File:", filePath);
  console.log("Size:", raw.length);

  const direct = tryParse(raw);
  if (direct) {
    console.log("File already valid. Projects:", (direct.projects || []).length);
    process.exit(0);
  }

  const bak = filePath + ".corrupt-" + Date.now() + ".bak";
  fs.copyFileSync(filePath, bak);
  console.log("Backup:", bak);

  const recovered = salvageJson(raw);
  if (!recovered.ok) {
    console.error("Recovery failed:", recovered.error);
    process.exit(1);
  }

  const data = recovered.data;
  const projects = Array.isArray(data.projects) ? data.projects : [];
  console.log("Method:", recovered.method);
  console.log("Recovered projects:", projects.length);
  for (const p of projects) {
    console.log(" -", p.id, "|", p.name, "| tree children:", p.fileTree?.children?.length || 0);
    if (p.fileTree) p.fileTree = slimFileTree(p.fileTree);
  }

  const out = {
    categories: data.categories || [],
    projects,
    settings: data.settings || { seeded: true },
  };

  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(out, null, 2), "utf8");
  fs.renameSync(tmp, filePath);
  console.log("Wrote repaired file, size:", fs.statSync(filePath).size);
}

main();