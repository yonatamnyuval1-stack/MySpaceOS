const emb = require("../main/embed-window");
console.log("ok", emb.isEmbedAvailable());
const { execFileSync } = require("child_process");
const out = execFileSync(
  "tasklist",
  ["/FI", "IMAGENAME eq explorer.exe", "/FO", "CSV", "/NH"],
  { encoding: "utf8" }
);
const m = out.match(/"(\d+)"/);
const pid = m && m[1];
console.log("pid", pid);
if (pid) console.log("hwnds", emb.findWindowsForPid(pid).length);
