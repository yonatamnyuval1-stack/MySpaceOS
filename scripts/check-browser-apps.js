#!/usr/bin/env node
/**
 * Browser app entry files must not use Node require()/import at top level.
 * A single require() crashes the whole Runtime UI (empty tree, dead buttons).
 *
 * Also auto-strips a few known accidental inject patterns so `npm start` can
 * recover without a manual edit when autocomplete re-inserts them.
 */
const fs = require("fs");
const path = require("path");

const roots = [path.join(__dirname, "..", "apps")];
const bad = [];
const stripped = [];
const re = /^\s*(?:const|let|var)\s+.*=\s*require\s*\(|^\s*require\s*\(|^\s*import\s+/m;
const autoStripRe =
  /^\s*(?:const|let|var)\s*\{[^}]*\}\s*=\s*require\s*\(\s*["']@composio\/core["']\s*\)\s*;?\s*\r?\n/gm;

function walk(dir) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name === "node_modules") continue;
      walk(full);
      continue;
    }
    if (name.name !== "app.js") continue;
    let text = fs.readFileSync(full, "utf8");
    const rel = path.relative(path.join(__dirname, ".."), full).replace(/\\/g, "/");

    if (autoStripRe.test(text)) {
      text = text.replace(autoStripRe, "");
      // collapse leftover blank lines at top
      text = text.replace(/^(?:\r?\n)+/, "");
      fs.writeFileSync(full, text, "utf8");
      stripped.push(rel);
    }

    const head = text.slice(0, 1200);
    if (re.test(head)) {
      bad.push(rel);
    }
  }
}

for (const root of roots) walk(root);

if (stripped.length) {
  console.warn("Auto-stripped accidental @composio require from:");
  for (const f of stripped) console.warn(" -", f);
}

if (bad.length) {
  console.error("Browser app.js files must not use require()/import (kills the UI):");
  for (const f of bad) console.error(" -", f);
  process.exit(1);
}
console.log("OK: no top-level require/import in apps/*/app.js");
