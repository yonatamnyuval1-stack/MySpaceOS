import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(__dirname, "national-animals.js"), "utf8");
const m = src.match(/const ANIMALS = \{([\s\S]*?)\n  \};/);
if (!m) {
  console.error("ANIMALS block not found");
  process.exit(1);
}

const titles = new Set();
for (const line of m[1].split("\n")) {
  const w = line.match(/wiki:\s*"([^"]+)"/);
  if (w) titles.add(w[1]);
}

const list = [...titles].sort();
console.log("unique titles:", list.length);

const UA = "MySpaceFlagQuiz/1.0 (desktop education quiz; offline-cache builder)";
const out = {};
const failed = [];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fullToThumb(source, width = 400) {
  if (!source || source.includes("/thumb/")) return source;
  try {
    const u = new URL(source);
    const full = u.pathname.match(/^(\/wikipedia\/[^/]+\/)([^/]+\/[^/]+\/)(.+)$/);
    if (!full) return source;
    const [, prefix, hashPath, fileName] = full;
    if (/\.svg$/i.test(fileName)) return source;
    return `${u.origin}${prefix}thumb/${hashPath}${fileName}/${width}px-${fileName}`;
  } catch {
    return source;
  }
}

async function wikiSummary(title) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "Api-User-Agent": UA, "User-Agent": UA },
  });
  if (res.status === 429) {
    await sleep(3500);
    return wikiSummary(title);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchThumb(title) {
  const data = await wikiSummary(title);
  let thumb = data?.thumbnail?.source || "";
  if (!thumb && data?.originalimage?.source) {
    thumb = fullToThumb(data.originalimage.source, 400);
  }
  return { thumb, resolved: data?.title || title, type: data?.type };
}

for (let i = 0; i < list.length; i++) {
  const title = list[i];
  process.stdout.write(`[${i + 1}/${list.length}] ${title} ... `);
  try {
    const { thumb, resolved, type } = await fetchThumb(title);
    if (!thumb) {
      console.log(`NO IMAGE (${type} ${resolved})`);
      failed.push({ title, reason: "no-thumb", resolved, type });
    } else {
      out[title] = thumb;
      console.log("OK");
    }
  } catch (e) {
    console.log("FAIL", e.message);
    failed.push({ title, reason: e.message });
  }
  await sleep(350);
}

fs.writeFileSync(path.join(__dirname, "animal-thumbs.json"), JSON.stringify(out, null, 2));
fs.writeFileSync(path.join(__dirname, "_thumb-failures.json"), JSON.stringify(failed, null, 2));
console.log("\nwrote count", Object.keys(out).length, "failed", failed.length);
