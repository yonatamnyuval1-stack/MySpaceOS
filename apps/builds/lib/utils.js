window.Builds = window.Builds || {};

window.Builds.invoke = async function (channel, args) {
  if (!window.myApp?.invoke) throw new Error("Open via My Space.");
  const result = await window.myApp.invoke(channel, args || {});
  if (result?.ok === false && result?.error) throw new Error(result.error);
  return result;
};

window.Builds.escapeHtml = function (s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};

window.Builds.uid = function (prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
};

window.Builds.formatDate = function (iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
};

window.Builds.formatCount = function (n) {
  const v = Number(n) || 0;
  try {
    return v.toLocaleString();
  } catch {
    return String(v);
  }
};

window.Builds.normRelPath = function (p) {
  return String(p || "")
    .replace(/\\/g, "/")
    .replace(/\/+$/, "")
    .toLowerCase();
};

window.Builds.isPathUnder = function (child, parent) {
  const c = window.Builds.normRelPath(child);
  const p = window.Builds.normRelPath(parent);
  if (!p || c === p) return false;
  return c.startsWith(`${p}/`);
};

window.Builds.topLevelSubCategoryItems = function (items) {
  const list = (items || []).filter((i) => i?.path);
  return list.filter(
    (item, i) => !list.some((other, j) => j !== i && window.Builds.isPathUnder(item.path, other.path))
  );
};

window.Builds.countFilesInTreeNode = function (node) {
  if (!node) return 0;
  if (node.type === "file") return 1;
  if (node.fileCount != null) return Number(node.fileCount) || 0;
  return (node.children || []).reduce((sum, child) => sum + window.Builds.countFilesInTreeNode(child), 0);
};

window.Builds.countSubCategoryFiles = function (sub, treeChildren, projectRoot, resolveFullPath, findNodeByPath) {
  const tops = window.Builds.topLevelSubCategoryItems(sub?.items);
  if (!tops.length) return 0;

  let total = 0;
  for (const item of tops) {
    if (item.type === "file") {
      total += 1;
      continue;
    }
    const full = resolveFullPath(projectRoot, item.path);
    const node = findNodeByPath(treeChildren || [], full);
    if (node) {
      total += window.Builds.countFilesInTreeNode(node);
      continue;
    }
    const nestedFiles = (sub.items || []).filter((i) => i.type === "file" && window.Builds.isPathUnder(i.path, item.path));
    total += nestedFiles.length || 0;
  }
  return total;
};

window.Builds.buildRunScript = function (sub, projectRoot, resolveFullPath) {
  const cmd = String(sub?.runCommand || "").trim();
  if (!cmd || !projectRoot) return "";
  const cwd = sub?.runCwd
    ? resolveFullPath(projectRoot, sub.runCwd)
    : String(projectRoot).replace(/[/\\]+$/, "");
  const escaped = cwd.replace(/"/g, '""');
  return `cd "${escaped}"\r\n${cmd}`;
};

window.Builds.fileIcon = function (name) {
  const ext = String(name || "").split(".").pop()?.toLowerCase() || "";
  const map = {
    js: "📜",
    ts: "📘",
    jsx: "⚛️",
    tsx: "⚛️",
    json: "📋",
    html: "🌐",
    css: "🎨",
    md: "📝",
    py: "🐍",
    ps1: "💻",
    bat: "💻",
    sh: "💻",
    png: "🖼",
    jpg: "🖼",
    svg: "🖼",
    xlsx: "📊",
    xls: "📊",
    csv: "📊",
    pdf: "📕",
    doc: "📄",
    docx: "📄",
    txt: "📝",
  };
  return map[ext] || "📄";
};

window.Builds.fileKind = function (name) {
  const raw = String(name || "").trim();
  const base = raw.split(/[/\\]/).pop() || raw;
  const baseLower = base.toLowerCase();
  // Extensionless / special filenames that are still source/config
  const codeBasenames = new Set([
    "dockerfile",
    "containerfile",
    "makefile",
    "gnumakefile",
    "cmakelists.txt",
    "gemfile",
    "rakefile",
    "procfile",
    "vagrantfile",
    "brewfile",
    "justfile",
    "taskfile.yml",
    "taskfile.yaml",
    "podfile",
    "fastfile",
    "appfile",
    "matchfile",
    "pluginfile",
    "jenkinsfile",
    "pipfile",
    "poetry.lock",
    "cargo.lock",
    "go.mod",
    "go.sum",
    "package.json",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "composer.json",
    "composer.lock",
    "tsconfig.json",
    "jsconfig.json",
    ".gitignore",
    ".gitattributes",
    ".gitmodules",
    ".dockerignore",
    ".editorconfig",
    ".npmrc",
    ".nvmrc",
    ".node-version",
    ".python-version",
    ".ruby-version",
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
    ".env.example",
    ".eslintrc",
    ".prettierrc",
    ".babelrc",
    ".htaccess",
    "license",
    "licence",
    "copying",
    "authors",
    "contributors",
    "changelog",
    "readme",
  ]);
  if (codeBasenames.has(baseLower)) return "code";

  const dot = base.lastIndexOf(".");
  const ext = dot > 0 ? base.slice(dot + 1).toLowerCase() : baseLower.includes(".") ? baseLower.replace(/^\./, "") : "";
  // Dotfiles like `.gitignore` already handled; `.eslintrc.json` → json below

  const code = new Set([
    // JS / TS
    "js", "ts", "jsx", "tsx", "mjs", "cjs", "mts", "cts", "vue", "svelte", "astro",
    // Web
    "html", "htm", "css", "scss", "sass", "less", "styl", "stylus",
    "pug", "jade", "ejs", "hbs", "handlebars", "mustache", "njk", "liquid", "twig",
    // Data / config
    "json", "jsonc", "json5", "xml", "xsl", "xsd", "yaml", "yml", "toml", "ini", "cfg", "conf", "config",
    "env", "properties", "prop", "plist", "desktop", "service", "nft",
    // Scripting
    "py", "pyw", "pyi", "rb", "rake", "php", "pl", "pm", "t", "lua", "r", "jl", "coffee", "litcoffee",
    "sh", "bash", "zsh", "fish", "ps1", "psm1", "psd1", "bat", "cmd", "vbs", "ahk", "awk",
    // Systems
    "c", "h", "cc", "cpp", "cxx", "hpp", "hh", "hxx", "inl", "ipp",
    "cs", "fs", "fsx", "fsi", "vb", "vbscript",
    "go", "rs", "zig", "nim", "nims", "d", "di",
    "java", "kt", "kts", "groovy", "gradle", "scala", "sc", "clj", "cljs", "cljc", "edn",
    "swift", "m", "mm", "pas", "pp", "inc",
    // Functional / others
    "hs", "lhs", "ml", "mli", "re", "rei", "res", "resi", "ex", "exs", "erl", "hrl", "elm", "purs",
    "dart", "sol", "move", "v", "sv", "svh", "vhdl", "vhd",
    "asm", "s", "wat", "wast",
    "cu", "cuh", "cl", "glsl", "hlsl", "wgsl", "metal", "vert", "frag", "comp",
    // Query / schema / infra
    "sql", "psql", "mysql", "graphql", "gql", "prisma", "proto", "thrift", "avsc",
    "tf", "tfvars", "hcl", "nomad", "nix", "cmake", "make", "mk", "bazel", "bzl", "buck",
    "dockerfile", "containerfile", "gitignore", "gitattributes", "dockerignore", "editorconfig",
    "npmrc", "eslintrc", "prettierrc", "babelrc", "browserslist",
    // Notebooks / docs-as-code
    "ipynb", "rmd", "qmd", "tex", "bib", "cls", "sty",
    // Misc source-adjacent
    "map", "lock", "patch", "diff", "reg", "manifest",
  ]);
  if (code.has(ext)) return "code";

  const sheet = new Set(["xlsx", "xls", "xlsm", "ods", "csv", "tsv", "gsheet"]);
  const doc = new Set(["doc", "docx", "odt", "pages"]);
  const image = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif", "heic"]);
  const binary = new Set([
    "exe", "dll", "so", "dylib", "bin", "dat", "o", "obj", "a", "lib", "class", "jar", "war",
    "zip", "7z", "rar", "gz", "tgz", "bz2", "xz", "tar", "iso", "dmg", "pkg",
    "mp3", "mp4", "wav", "flac", "avi", "mkv", "mov", "webm", "ogg",
    "woff", "woff2", "ttf", "otf", "eot", "pdb", "msi", "cab", "apk", "ipa", "wasm",
  ]);
  // Markdown / notes = Code docs inside Builds (not a separate "Text" kind)
  const codeDocs = new Set(["txt", "md", "markdown", "log", "rtf", "rst", "adoc", "asciidoc", "textile", "org"]);
  if (codeDocs.has(ext)) return "code";
  if (sheet.has(ext)) return "sheet";
  if (doc.has(ext)) return "document";
  if (image.has(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (binary.has(ext)) return "other";
  // Builds is a code inventory — unknown extensions default to Code, not "File"
  return "code";
};

window.Builds.attachmentKind = function (att) {
  if (att?.type === "folder") return "folder";
  return window.Builds.fileKind(att?.name || "");
};

window.Builds.kindIconHtml = function (kind) {
  const icons = {
    code: `<svg class="kind-logo" viewBox="0 0 80 80" aria-hidden="true">
      <rect width="80" height="80" rx="14" fill="#2563eb"/>
      <text x="40" y="52" text-anchor="middle" fill="#fff" font-size="28" font-weight="700" font-family="'Cascadia Code','Consolas',monospace">&lt;/&gt;</text>
    </svg>`,
    folder: `<svg class="kind-logo" viewBox="0 0 80 80" aria-hidden="true">
      <rect width="80" height="80" rx="14" fill="#334155"/>
      <path d="M18 28h18l8 10h18a6 6 0 0 1 6 6v16a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6V34a6 6 0 0 1 6-6z" fill="#f59e0b" opacity="0.95"/>
      <path d="M18 28h18l6 8h20v4H18v-4z" fill="#fbbf24"/>
    </svg>`,
    sheet: `<svg class="kind-logo" viewBox="0 0 80 80" aria-hidden="true">
      <rect width="80" height="80" rx="14" fill="#0f9d58"/>
      <rect x="22" y="20" width="36" height="40" rx="3" fill="#fff"/>
      <rect x="26" y="28" width="12" height="4" rx="1" fill="#0f9d58"/>
      <rect x="26" y="36" width="28" height="4" rx="1" fill="#a7f3d0"/>
      <rect x="26" y="44" width="28" height="4" rx="1" fill="#a7f3d0"/>
      <rect x="26" y="52" width="20" height="4" rx="1" fill="#a7f3d0"/>
    </svg>`,
    text: `<svg class="kind-logo" viewBox="0 0 80 80" aria-hidden="true">
      <rect width="80" height="80" rx="14" fill="#7c3aed"/>
      <text x="40" y="54" text-anchor="middle" fill="#fff" font-size="36" font-family="Georgia,serif">¶</text>
    </svg>`,
    document: `<svg class="kind-logo" viewBox="0 0 80 80" aria-hidden="true">
      <rect width="80" height="80" rx="14" fill="#0284c7"/>
      <path d="M28 18h16l12 12v32a4 4 0 0 1-4 4H28a4 4 0 0 1-4-4V22a4 4 0 0 1 4-4z" fill="#fff"/>
      <path d="M44 18v12h12" fill="none" stroke="#bae6fd" stroke-width="2"/>
      <rect x="30" y="38" width="24" height="3" rx="1.5" fill="#0284c7"/>
      <rect x="30" y="46" width="20" height="3" rx="1.5" fill="#0284c7"/>
    </svg>`,
    image: `<svg class="kind-logo" viewBox="0 0 80 80" aria-hidden="true">
      <rect width="80" height="80" rx="14" fill="#db2777"/>
      <circle cx="30" cy="32" r="6" fill="#fce7f3"/>
      <path d="M18 58l16-16 10 10 8-8 14 14H18z" fill="#fff" opacity="0.9"/>
    </svg>`,
    pdf: `<svg class="kind-logo" viewBox="0 0 80 80" aria-hidden="true">
      <rect width="80" height="80" rx="14" fill="#dc2626"/>
      <text x="40" y="50" text-anchor="middle" fill="#fff" font-size="22" font-weight="700" font-family="Arial,sans-serif">PDF</text>
    </svg>`,
    other: `<svg class="kind-logo" viewBox="0 0 80 80" aria-hidden="true">
      <rect width="80" height="80" rx="14" fill="#475569"/>
      <path d="M28 22h24v36H28z" fill="#fff" opacity="0.9"/>
      <rect x="32" y="30" width="16" height="3" rx="1" fill="#475569"/>
      <rect x="32" y="38" width="12" height="3" rx="1" fill="#475569"/>
    </svg>`,
  };
  return icons[kind] || icons.other;
};

window.Builds.fileKindMeta = function (nameOrAtt) {
  const att = typeof nameOrAtt === "object" ? nameOrAtt : null;
  const name = att ? att.name : nameOrAtt;
  const kind = att ? window.Builds.attachmentKind(att) : window.Builds.fileKind(name);
  const ext = String(name || "").split(".").pop()?.toUpperCase() || "FILE";
  const meta = {
    code: {
      kind: "code",
      label: "Code",
      short: ext,
      color: "#00ADD8",
      gradient: "linear-gradient(145deg, #007d9c 0%, #0f172a 100%)",
    },
    folder: {
      kind: "folder",
      label: "Folder",
      short: "DIR",
      color: "#f59e0b",
      gradient: "linear-gradient(145deg, #78350f 0%, #0f172a 100%)",
    },
    sheet: {
      kind: "sheet",
      label: "Spreadsheet",
      short: ext,
      color: "#0f9d58",
      gradient: "linear-gradient(145deg, #064e3b 0%, #0f172a 100%)",
    },
    text: {
      kind: "text",
      label: "Text",
      short: ext,
      color: "#a78bfa",
      gradient: "linear-gradient(145deg, #3b2d6b 0%, #0f172a 100%)",
    },
    document: {
      kind: "document",
      label: "Document",
      short: ext,
      color: "#38bdf8",
      gradient: "linear-gradient(145deg, #0c4a6e 0%, #0f172a 100%)",
    },
    image: {
      kind: "image",
      label: "Image",
      short: ext,
      color: "#f472b6",
      gradient: "linear-gradient(145deg, #831843 0%, #0f172a 100%)",
    },
    pdf: {
      kind: "pdf",
      label: "PDF",
      short: "PDF",
      color: "#f87171",
      gradient: "linear-gradient(145deg, #7f1d1d 0%, #0f172a 100%)",
    },
    other: {
      kind: "other",
      label: "File",
      short: ext,
      color: "#94a3b8",
      gradient: "linear-gradient(145deg, #334155 0%, #0f172a 100%)",
    },
  };
  const m = meta[kind] || meta.other;
  return { ...m, iconHtml: window.Builds.kindIconHtml(m.kind) };
};

window.Builds.parseCsvPreview = function (content, maxRows = 40) {
  const lines = String(content || "")
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
    .slice(0, maxRows);
  if (!lines.length) return { headers: [], rows: [] };
  const parseLine = (line) => {
    const cells = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        cells.push(cur);
        cur = "";
      } else cur += ch;
    }
    cells.push(cur);
    return cells;
  };
  const rows = lines.map(parseLine);
  const headers = rows[0] || [];
  const data = rows.slice(1);
  return { headers, rows: data };
};

window.Builds.ICON_PICKS = ["🏗️", "🖥️", "🌐", "📱", "🎮", "⚙️", "📦", "🚀", "🧪", "🔧", "🏠", "💡", "🤖", "📊"];

window.Builds._iconSvgCache = window.Builds._iconSvgCache || new Map();

window.Builds.mslIconsEnabled = function () {
  return window.AppSettingsRuntime?.isOn?.("mslIcons") !== false;
};

window.Builds.projectIconHtml = function (project, opts = {}) {
  const escapeHtml = window.Builds.escapeHtml;
  const emoji = escapeHtml(project?.icon || "🏗️");
  const iconId = String(project?.iconId || "").trim();
  const cache = window.Builds._iconSvgCache;
  const svg = iconId ? cache.get(iconId) : "";
  if (iconId && svg && window.Builds.mslIconsEnabled()) {
    return `<span class="msl-icon-svg" data-icon-id="${escapeHtml(iconId)}">${svg}</span><span class="msl-icon-fallback">${emoji}</span>`;
  }
  if (iconId && window.Builds.mslIconsEnabled()) {
    return `<span class="msl-icon-svg msl-icon-pending" data-icon-id="${escapeHtml(iconId)}"></span><span class="msl-icon-fallback" style="display:inline">${emoji}</span>`;
  }
  return `<span class="msl-icon-fallback" style="display:inline">${emoji}</span>`;
};

window.Builds.hydrateProjectIcons = async function (projects) {
  if (!window.Builds.mslIconsEnabled() || !window.Msl?.invoke) return;
  const ids = [
    ...new Set(
      (projects || [])
        .map((p) => String(p?.iconId || "").trim())
        .filter(Boolean)
    ),
  ].filter((id) => !window.Builds._iconSvgCache.has(id));
  if (!ids.length) return;
  try {
    const res = await window.Msl.invoke("icons.get", {
      ids,
      size: 28,
      color: "currentColor",
    });
    if (!res?.ok) return;
    for (const icon of res.icons || []) {
      if (icon?.id && icon?.svg) window.Builds._iconSvgCache.set(icon.id, icon.svg);
    }
  } catch {
    /* ignore — emoji fallback stays */
  }
};

window.Builds.applyCachedIconsInDom = function (root) {
  const scope = root || document;
  const cache = window.Builds._iconSvgCache;
  scope.querySelectorAll(".msl-icon-svg[data-icon-id]").forEach((el) => {
    const id = el.getAttribute("data-icon-id");
    const svg = id && cache.get(id);
    if (!svg) return;
    el.innerHTML = svg;
    el.classList.remove("msl-icon-pending");
    const fallback = el.nextElementSibling;
    if (fallback?.classList?.contains("msl-icon-fallback")) {
      fallback.style.display = "none";
    }
  });
};
