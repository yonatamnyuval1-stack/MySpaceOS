const path = require("path");
const fs = require("fs");
const { execFile, spawn } = require("child_process");
const { promisify } = require("util");
const jobsStore = require("../jobs/store");
const { resolveWorkspacePath, ensureWorkspaceRoot } = require("./files-ipc");

const execFileAsync = promisify(execFile);

const ALLOWED_RUNTIMES = new Set(["python", "py", "node", "nodejs", "powershell", "ps", "pwsh"]);

function assertHostRunAllowed() {
  const state = jobsStore.load();
  const cap = jobsStore.normalizeCapacity(state?.capacity);
  if (cap.allowHost === false) {
    return {
      ok: false,
      error: "Host run blocked: enable in Permissions → Jobs → Allow host language runs",
    };
  }
  return { ok: true };
}

function resolveFileRef(ref) {
  const raw = String(ref || "").trim();
  if (!raw) return { ok: false, error: "Script path required (file:tools/x.py)" };
  const rel = raw.replace(/^file:/i, "");
  return resolveWorkspacePath(rel);
}

function resolveWorkspaceCwd(cwd) {
  const raw = String(cwd || "").trim();
  if (!raw) return { ok: true, path: ensureWorkspaceRoot() };
  return resolveWorkspacePath(raw);
}

function parseExtraArgs(value) {
  const raw = String(value || "").trim();
  if (!raw) return [];
  const out = [];
  const re = /"([^"\\]|\\.)*"|'([^'\\]|\\.)*'|[^\s]+/g;
  let m;
  while ((m = re.exec(raw))) {
    let tok = m[0];
    if ((tok.startsWith('"') && tok.endsWith('"')) || (tok.startsWith("'") && tok.endsWith("'"))) {
      tok = tok.slice(1, -1);
    }
    if (tok) out.push(tok);
  }
  return out;
}

function powershellExe() {
  if (process.platform === "win32") {
    return path.join(
      process.env.WINDIR || "C:\\Windows",
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe"
    );
  }
  return "powershell";
}

function buildRuntimeCommand(runtime, scriptPath, extraArgs = []) {
  const r = String(runtime || "").trim().toLowerCase();
  if (!ALLOWED_RUNTIMES.has(r)) {
    return {
      ok: false,
      error: `Runtime not allowed: ${runtime}. Use python, node, or powershell.`,
    };
  }

  if (r === "python") {
    return { ok: true, command: "python", args: [scriptPath, ...extraArgs] };
  }
  if (r === "py") {
    return { ok: true, command: "py", args: ["-3", scriptPath, ...extraArgs] };
  }
  if (r === "node" || r === "nodejs") {
    return { ok: true, command: "node", args: [scriptPath, ...extraArgs] };
  }
  if (r === "powershell" || r === "ps") {
    const ps = powershellExe();
    return {
      ok: true,
      command: ps,
      args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, ...extraArgs],
    };
  }
  if (r === "pwsh") {
    return {
      ok: true,
      command: "pwsh",
      args: ["-NoProfile", "-File", scriptPath, ...extraArgs],
    };
  }

  return { ok: false, error: `Unsupported runtime: ${runtime}` };
}

function spawnDetached(command, args, options) {
  return new Promise((resolve, reject) => {
    try {
      const child = spawn(command, args, {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
        shell: false,
        ...options,
      });
      child.on("error", reject);
      child.unref();
      resolve({ pid: child.pid });
    } catch (err) {
      reject(err);
    }
  });
}

async function runHostProcess(args = {}) {
  const gate = assertHostRunAllowed();
  if (!gate.ok) return gate;

  const runtime = String(args.runtime || "").trim();
  if (!runtime) return { ok: false, error: "Runtime required (python, node, powershell)" };

  const scriptRef = args.scriptPath || args.script || args.file;
  const resolved = resolveFileRef(scriptRef);
  if (!resolved.ok) return resolved;

  const scriptPath = resolved.path;
  if (!fs.existsSync(scriptPath)) {
    return { ok: false, error: `Script not found: ${resolved.relative}` };
  }
  const st = fs.statSync(scriptPath);
  if (!st.isFile()) {
    return { ok: false, error: "Script path must be a file" };
  }

  let cwd = path.dirname(scriptPath);
  if (args.cwd) {
    const cwdResolved = resolveWorkspaceCwd(args.cwd);
    if (!cwdResolved.ok) return cwdResolved;
    cwd = cwdResolved.path;
  }

  const extraArgs = Array.isArray(args.args)
    ? args.args.map(String)
    : parseExtraArgs(args.args || args.arg || "");

  const cmd = buildRuntimeCommand(runtime, scriptPath, extraArgs);
  if (!cmd.ok) return cmd;

  const wait = args.wait !== false && args.detached !== true;
  const timeoutMs = Math.max(
    1000,
    Math.min(600000, Number(args.timeoutMs || args.timeout || 120000) || 120000)
  );
  const started = Date.now();

  if (!wait) {
    try {
      const detached = await spawnDetached(cmd.command, cmd.args, { cwd });
      return {
        ok: true,
        detached: true,
        pid: detached.pid,
        runtime,
        script: resolved.relative,
        cwd,
        durationMs: Date.now() - started,
      };
    } catch (err) {
      return {
        ok: false,
        error: err.message || "Could not start host process",
        runtime,
        script: resolved.relative,
      };
    }
  }

  try {
    const { stdout, stderr } = await execFileAsync(cmd.command, cmd.args, {
      cwd,
      windowsHide: true,
      timeout: timeoutMs,
      maxBuffer: 4 * 1024 * 1024,
      env: process.env,
    });
    const out = String(stdout || "").trim();
    const errOut = String(stderr || "").trim();
    return {
      ok: true,
      runtime,
      script: resolved.relative,
      exitCode: 0,
      stdout: out,
      stderr: errOut,
      message: out || errOut || "Host process finished",
      durationMs: Date.now() - started,
    };
  } catch (err) {
    const out = String(err.stdout || "").trim();
    const errOut = String(err.stderr || "").trim();
    return {
      ok: false,
      runtime,
      script: resolved.relative,
      exitCode: Number.isFinite(err.code) ? err.code : 1,
      stdout: out,
      stderr: errOut,
      durationMs: Date.now() - started,
      error: err.message || "Host process failed",
      message: errOut || out || err.message || "Host process failed",
    };
  }
}

async function whichRuntime(runtime) {
  const r = String(runtime || "").trim().toLowerCase();
  if (!r) return { ok: false, error: "Runtime required" };
  const cmd = buildRuntimeCommand(r, path.join(ensureWorkspaceRoot(), ".probe"));
  if (!cmd.ok) return cmd;

  try {
    if (r === "powershell" || r === "ps") {
      const exists = process.platform !== "win32" || fs.existsSync(cmd.command);
      return { ok: exists, runtime: r, command: cmd.command, found: exists };
    }
    await execFileAsync(process.platform === "win32" ? "where" : "which", [cmd.command], {
      windowsHide: true,
      timeout: 8000,
    });
    return { ok: true, runtime: r, command: cmd.command, found: true };
  } catch {
    return { ok: true, runtime: r, command: cmd.command, found: false };
  }
}

async function handleHostInvoke(channel, args = {}) {
  const ch = String(channel || "").trim();

  switch (ch) {
    case "host.run":
    case "run":
      return runHostProcess(args);

    case "host.which":
    case "which":
      return whichRuntime(args.runtime || args.name);

    case "host.runtimes":
    case "runtimes":
      return {
        ok: true,
        runtimes: ["python", "node", "powershell", "pwsh"],
        workspace: ensureWorkspaceRoot(),
      };

    case "status":
      return {
        ok: true,
        workspace: ensureWorkspaceRoot(),
        runtimes: ["python", "node", "powershell", "pwsh"],
      };

    default:
      return { ok: false, error: `Unknown host channel: ${ch}` };
  }
}

module.exports = { handleHostInvoke, runHostProcess, resolveFileRef, buildRuntimeCommand };
