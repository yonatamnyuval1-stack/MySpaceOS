const { app } = require("electron");
const path = require("path");
const fs = require("fs");

app.whenReady().then(async () => {
  const userData = path.join(__dirname, "..", ".tmp-theme-smoke", "files-write-userData");
  fs.mkdirSync(userData, { recursive: true });
  app.setPath("userData", userData);

  const jobsFile = path.join(userData, "jobs-platform.json");
  try {
    if (fs.existsSync(jobsFile)) fs.unlinkSync(jobsFile);
  } catch {
  }

  const workspace = path.join(userData, "workspace");
  try {
    if (fs.existsSync(workspace)) fs.rmSync(workspace, { recursive: true, force: true });
  } catch {
  }

  const { handleFilesInvoke } = require("../main/apps/files-ipc");
  const jobsStore = require("../main/jobs/store");
  const checks = [];
  const ok = (name, pass, detail) => checks.push({ name, ok: !!pass, detail });

  const root = await handleFilesInvoke("workspace.root", {});
  ok("workspace root", root.ok && root.path === workspace, root);

  const mkdir = await handleFilesInvoke("dir.mkdir", { path: "tools/smoke" });
  ok(
    "mkdir nested",
    mkdir.ok && (mkdir.relative === "tools\\smoke" || mkdir.relative === "tools/smoke"),
    mkdir
  );

  const wrote = await handleFilesInvoke("file.write", {
    path: "tools/smoke/hello.txt",
    content: "hello workspace\n",
  });
  ok("write file", wrote.ok && wrote.bytes > 0, wrote);

  const diskPath = path.join(workspace, "tools", "smoke", "hello.txt");
  ok("file on disk", fs.existsSync(diskPath), fs.readFileSync(diskPath, "utf8"));

  const appended = await handleFilesInvoke("file.write", {
    path: "tools/smoke/hello.txt",
    content: "more\n",
    append: true,
  });
  ok("append file", appended.ok && fs.readFileSync(diskPath, "utf8").includes("more"), appended);

  const outside = await handleFilesInvoke("file.write", {
    path: "../escape.txt",
    content: "nope",
  });
  ok("sandbox blocks outside", !outside.ok && /workspace/i.test(outside.error || ""), outside.error);

  const state = jobsStore.load();
  state.capacity = jobsStore.normalizeCapacity({ ...state.capacity, allowFileWrite: false });
  jobsStore.save(state);

  const blocked = await handleFilesInvoke("file.write", {
    path: "blocked.txt",
    content: "nope",
  });
  ok("permission gate blocks write", !blocked.ok && /blocked/i.test(blocked.error || ""), blocked.error);

  state.capacity = jobsStore.normalizeCapacity({ ...state.capacity, allowFileWrite: true });
  jobsStore.save(state);

  const copied = await handleFilesInvoke("file.workspace.copy", {
    src: "tools/smoke/hello.txt",
    dest: "tools/smoke/copy.txt",
  });
  ok("workspace copy", copied.ok && fs.existsSync(path.join(workspace, "tools", "smoke", "copy.txt")), copied);

  const failed = checks.filter((c) => !c.ok);
  console.log(JSON.stringify({ checks, failed: failed.length }, null, 2));
  if (failed.length) {
    console.error("FAIL: files write/mkdir smoke");
    app.exit(1);
    return;
  }
  console.log("OK: files(write/mkdir) verified");
  app.exit(0);
});

app.on("window-all-closed", (e) => e.preventDefault());