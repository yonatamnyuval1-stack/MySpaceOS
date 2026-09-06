const fs = require("fs");
const path = require("path");

const APPS = path.join(__dirname, "..", "apps");
let fixed = 0;
const left = [];

for (const name of fs.readdirSync(APPS)) {
  const file = path.join(APPS, name, "preload.js");
  if (!fs.existsSync(file)) continue;
  let src = fs.readFileSync(file, "utf8");
  if (!/theme-preload|attachThemesApi|__attachThemesApi|Themes bridge failed|myAppThemes/.test(src)) {
    continue;
  }
  const before = src;

  src = src.replace(
    /try\s*\{[\s\S]*?theme-preload[\s\S]*?\}\s*catch\s*\([^)]*\)\s*\{[\s\S]*?Themes bridge failed[\s\S]*?\}\s*/g,
    ""
  );
  src = src.replace(
    /try\s*\{[\s\S]*?__attachThemesApi[\s\S]*?\}\s*catch\s*\([^)]*\)\s*\{[\s\S]*?\}\s*/g,
    ""
  );
  src = src.replace(
    /let __attachThemesApi = null;\s*/g,
    ""
  );
  src = src.replace(
    /const \{ attachThemesApi \} = require\([^;]+;\s*/g,
    ""
  );
  src = src.replace(
    /(?:if\s*\(__attachThemesApi\)\s*)?__attachThemesApi\s*&&\s*__attachThemesApi\([^;]+;\s*/g,
    ""
  );
  src = src.replace(/attachThemesApi\([^;]+;\s*/g, "");

  if (
    /const path = require\(["']path["']\);/.test(src) &&
    !/\bpath\./.test(src.replace(/const path = require\(["']path["']\);/, ""))
  ) {
    src = src.replace(/const path = require\(["']path["']\);\s*/g, "");
  }

  src = src.replace(/\n{3,}/g, "\n\n");
  if (src !== before) {
    fs.writeFileSync(file, src);
    fixed++;
  }
  if (/theme-preload|attachThemesApi|Themes bridge failed/.test(src)) {
    left.push(name);
  }
}

console.log(JSON.stringify({ fixed, left }, null, 2));
if (left.length) process.exitCode = 1;
