const CODE_BASENAMES = new Set([
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

const CODE_EXT = new Set([
  "js", "ts", "jsx", "tsx", "mjs", "cjs", "mts", "cts", "vue", "svelte", "astro",
  "html", "htm", "css", "scss", "sass", "less", "styl", "stylus",
  "pug", "jade", "ejs", "hbs", "handlebars", "mustache", "njk", "liquid", "twig",
  "json", "jsonc", "json5", "xml", "xsl", "xsd", "yaml", "yml", "toml", "ini", "cfg", "conf", "config",
  "env", "properties", "prop", "plist", "desktop", "service",
  "py", "pyw", "pyi", "rb", "rake", "php", "pl", "pm", "lua", "r", "jl", "coffee",
  "sh", "bash", "zsh", "fish", "ps1", "psm1", "psd1", "bat", "cmd", "vbs", "ahk", "awk",
  "c", "h", "cc", "cpp", "cxx", "hpp", "hh", "hxx", "inl",
  "cs", "fs", "fsx", "vb",
  "go", "rs", "zig", "nim", "d",
  "java", "kt", "kts", "groovy", "gradle", "scala", "clj", "cljs",
  "swift", "m", "mm", "pas",
  "hs", "ml", "mli", "ex", "exs", "erl", "elm", "dart", "sol",
  "asm", "s", "wat", "cu", "glsl", "hlsl", "wgsl",
  "sql", "graphql", "gql", "prisma", "proto",
  "tf", "tfvars", "hcl", "nix", "cmake", "make", "mk",
  "dockerfile", "gitignore", "dockerignore", "editorconfig",
  "ipynb", "rmd", "tex", "bib",
  "map", "lock", "patch", "diff",
  "txt", "md", "markdown", "log", "rst", "adoc",
]);

const SHEET_EXT = new Set(["xlsx", "xls", "xlsm", "ods", "csv", "tsv", "gsheet"]);
const DOC_EXT = new Set(["doc", "docx", "odt", "pages"]);
const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif", "heic"]);
const BINARY_EXT = new Set([
  "exe", "dll", "so", "dylib", "bin", "dat", "o", "obj", "a", "lib", "class", "jar", "war",
  "zip", "7z", "rar", "gz", "tgz", "bz2", "xz", "tar", "iso", "dmg", "pkg",
  "mp3", "mp4", "wav", "flac", "avi", "mkv", "mov", "webm", "ogg",
  "woff", "woff2", "ttf", "otf", "eot", "pdb", "msi", "apk", "ipa", "wasm",
]);

function fileKind(name) {
  const raw = String(name || "").trim();
  const base = raw.split(/[/\\]/).pop() || raw;
  const baseLower = base.toLowerCase();
  if (CODE_BASENAMES.has(baseLower)) return "code";

  const dot = base.lastIndexOf(".");
  const ext =
    dot > 0
      ? base.slice(dot + 1).toLowerCase()
      : baseLower.includes(".")
        ? baseLower.replace(/^\./, "")
        : "";

  if (CODE_EXT.has(ext)) return "code";
  if (SHEET_EXT.has(ext)) return "sheet";
  if (DOC_EXT.has(ext)) return "document";
  if (IMAGE_EXT.has(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (BINARY_EXT.has(ext)) return "other";
  return "code";
}

function attachmentKind(att) {
  if (att?.type === "folder") return "folder";
  return fileKind(att?.name || "");
}

const api = { fileKind, attachmentKind, CODE_EXT, SHEET_EXT, DOC_EXT, IMAGE_EXT };

if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.PartsFilesKind = api;