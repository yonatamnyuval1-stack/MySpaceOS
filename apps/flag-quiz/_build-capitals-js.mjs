import fs from "fs";

const d = JSON.parse(fs.readFileSync("capitals-data.json", "utf8"));
d.mo = { capital: "Macao", capitalHe: "מקאו" };
fs.writeFileSync("capitals-data.json", JSON.stringify(d, null, 2));
const body =
  "/** Auto-generated country capitals (EN/HE). */\n" +
  "(function (root) {\n" +
  "  root.FlagQuizCapitalsData = " +
  JSON.stringify(d) +
  ";\n" +
  "})(typeof window !== \"undefined\" ? window : globalThis);\n";
fs.writeFileSync("capitals-data.js", body);
console.log("keys", Object.keys(d).length, "bytes", body.length);
