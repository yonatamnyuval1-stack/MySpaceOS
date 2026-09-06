import fs from "fs";

const t = JSON.parse(fs.readFileSync("animal-thumbs.json", "utf8"));
const body =
  "/** Auto-generated Wikipedia thumbnail URLs for national animals. Do not edit by hand: re-run _fetch-thumbs.mjs */\n" +
  "(function (root) {\n" +
  "  root.FlagQuizAnimalThumbs = " +
  JSON.stringify(t, null, 2) +
  ";\n" +
  "})(typeof window !== \"undefined\" ? window : globalThis);\n";
fs.writeFileSync("animal-thumbs.js", body);
console.log("wrote animal-thumbs.js", Object.keys(t).length, "urls", body.length, "bytes");
