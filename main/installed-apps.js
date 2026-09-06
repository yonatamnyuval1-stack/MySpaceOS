const { shell } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const START_MENU_DIRS = [
  path.join(process.env.ProgramData || "", "Microsoft", "Windows", "Start Menu", "Programs"),
  path.join(process.env.APPDATA || "", "Microsoft", "Windows", "Start Menu", "Programs"),
];

function walkDir(dir, files = []) {
  if (!dir || !fs.existsSync(dir)) return files;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, files);
    } else if (entry.name.toLowerCase().endsWith(".lnk")) {
      files.push(full);
    }
  }
  return files;
}

function cleanName(fileName) {
  return fileName.replace(/\.lnk$/i, "").replace(/\.app$/i, "").replace(/\.desktop$/i, "").trim();
}

function scanInstalledProgramsWindows() {
  const shortcuts = START_MENU_DIRS.flatMap((dir) => walkDir(dir));
  const byTarget = new Map();

  for (const shortcutPath of shortcuts) {
    let details;
    try {
      details = shell.readShortcutLink(shortcutPath);
    } catch {
      continue;
    }
    const target = details?.target;
    if (!target || !/\.(exe|bat|cmd)$/i.test(target)) continue;
    if (!fs.existsSync(target)) continue;
    const key = target.toLowerCase();
    if (byTarget.has(key)) continue;
    byTarget.set(key, {
      name: cleanName(path.basename(shortcutPath)),
      paths: [target],
      shortcutPath,
    });
  }

  return Array.from(byTarget.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}

const APP_DIRS_MAC = [
  "/Applications",
  path.join(os.homedir(), "Applications"),
];

function scanInstalledProgramsMac() {
  const results = [];
  const seen = new Set();

  for (const dir of APP_DIRS_MAC) {
    if (!fs.existsSync(dir)) continue;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.name.endsWith(".app")) continue;
      const appPath = path.join(dir, entry.name);
      if (seen.has(appPath)) continue;
      seen.add(appPath);
      results.push({
        name: cleanName(entry.name),
        paths: [appPath],
      });
    }
  }

  return results.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}

const DESKTOP_DIRS_LINUX = [
  "/usr/share/applications",
  "/usr/local/share/applications",
  path.join(os.homedir(), ".local", "share", "applications"),
];

function stripDesktopFieldCodes(raw) {
  return String(raw || "")
    .replace(/%%/g, "%")
    .replace(/%[a-zA-Z]/g, "");
}

function extractExecFirstToken(execLine) {
  let line = String(execLine || "").trim();
  if (!line) return "";

  let token = "";
  if (line.startsWith('"')) {
    const m = line.match(/^"([^"]+)"/);
    token = m?.[1] ? m[1] : line.slice(1).split('"')[0];
  } else {
    token = line.split(/\s+/)[0];
  }

  token = stripDesktopFieldCodes(token).trim();
  return token.replace(/^"(.*)"$/, "$1").trim();
}

function resolveExecutablePath(cmd) {
  const c = String(cmd || "").trim();
  if (!c) return null;

  if (path.isAbsolute(c) && fs.existsSync(c)) return c;
  if (fs.existsSync(c)) return c;

  const candidates = [];
  const pathEnv = process.env.PATH || "";
  candidates.push(...pathEnv.split(path.delimiter).filter(Boolean));
  candidates.push("/usr/bin", "/bin", "/usr/local/bin");

  for (const dir of candidates) {
    const full = path.join(dir, c);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

function scanInstalledProgramsLinux() {
  const results = [];
  const byPath = new Map();

  for (const dir of DESKTOP_DIRS_LINUX) {
    if (!fs.existsSync(dir)) continue;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.toLowerCase().endsWith(".desktop")) continue;

      const full = path.join(dir, entry.name);
      let text = "";
      try {
        text = fs.readFileSync(full, "utf8");
      } catch {
        continue;
      }

      let name = "";
      let exec = "";
      let hidden = false;
      let noDisplay = false;

      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith(";")) continue;

        if (trimmed.startsWith("Hidden=")) hidden = trimmed.slice("Hidden=".length).trim().toLowerCase() === "true";
        if (trimmed.startsWith("NoDisplay="))
          noDisplay = trimmed.slice("NoDisplay=".length).trim().toLowerCase() === "true";
        if (trimmed.startsWith("Name=")) name = trimmed.slice("Name=".length).trim();
        if (trimmed.startsWith("Exec=")) exec = trimmed.slice("Exec=".length).trim();
      }

      if (hidden || noDisplay) continue;
      if (!exec) continue;

      const cmd = extractExecFirstToken(exec);
      if (!cmd) continue;

      const resolved = resolveExecutablePath(cmd);
      if (!resolved) continue;

      const key = resolved.toLowerCase();
      if (byPath.has(key)) continue;

      byPath.set(key, {
        name: cleanName(name || path.basename(resolved)),
        paths: [resolved],
        desktopPath: full,
      });
    }
  }

  return Array.from(byPath.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}

function scanInstalledPrograms() {
  if (process.platform === "darwin") return scanInstalledProgramsMac();
  if (process.platform === "win32") return scanInstalledProgramsWindows();
  if (process.platform === "linux") return scanInstalledProgramsLinux();
  return [];
}

module.exports = { scanInstalledPrograms };