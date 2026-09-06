import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const countriesSrc = fs.readFileSync(path.join(__dirname, "countries.js"), "utf8");
const codes = [...countriesSrc.matchAll(/\["([a-z]{2})",/g)].map((m) => m[1]);
const unique = [...new Set(codes)];
console.log("country codes:", unique.length);

const UA = "MySpaceFlagQuiz/1.0 (outline pack builder)";
const BASE = "https://cdn.jsdelivr.net/gh/djaiss/mapsicon@master/all";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeSvg(raw) {
  const viewBox =
    (raw.match(/viewBox\s*=\s*"([^"]+)"/i) || [])[1] || "0 0 1024 1024";
  const gOpen = raw.match(/<g\b[^>]*>/i)?.[0];
  const transform =
    (gOpen && (gOpen.match(/transform\s*=\s*"([^"]+)"/i) || [])[1]) ||
    "translate(0.000000,1024.000000) scale(0.100000,-0.100000)";

  const paths = [...raw.matchAll(/<path\b[^>]*\sd\s*=\s*"([^"]+)"[^>]*\/?>/gi)].map(
    (m) => m[1].replace(/\s+/g, " ").trim()
  );
  if (!paths.length) return "";

  const pathMarkup = paths.map((d) => `<path d="${d}"/>`).join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" ` +
    `preserveAspectRatio="xMidYMid meet">` +
    `<g fill="#e8eef8" stroke="none" transform="${transform}">${pathMarkup}</g>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function fetchSvg(code) {
  const url = `${BASE}/${code}/vector.svg`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "image/svg+xml,*/*" } });
  if (res.status === 404) return null;
  if (res.status === 429) {
    await sleep(2000);
    return fetchSvg(code);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

const out = {};
const missing = [];
const failed = [];

for (let i = 0; i < unique.length; i++) {
  const code = unique[i];
  process.stdout.write(`[${i + 1}/${unique.length}] ${code} ... `);
  try {
    const raw = await fetchSvg(code);
    if (!raw) {
      console.log("missing");
      missing.push(code);
      continue;
    }
    const uri = normalizeSvg(raw);
    if (!uri) {
      console.log("empty");
      failed.push({ code, reason: "no-path" });
      continue;
    }
    out[code] = uri;
    console.log("OK", Math.round(uri.length / 1024) + "kb");
  } catch (e) {
    console.log("FAIL", e.message);
    failed.push({ code, reason: e.message });
  }
  await sleep(80);
}

const js =
  "/** Auto-generated uniform country outline SVGs (data URIs). Re-run _build-outlines.mjs */\n" +
  "(function (root) {\n" +
  "  root.FlagQuizOutlineSvgs = " +
  JSON.stringify(out) +
  ";\n" +
  "})(typeof window !== \"undefined\" ? window : globalThis);\n";

fs.writeFileSync(path.join(__dirname, "outline-svgs.js"), js);
fs.writeFileSync(
  path.join(__dirname, "_outline-build-report.json"),
  JSON.stringify(
    { count: Object.keys(out).length, missing, failed, bytes: js.length },
    null,
    2
  )
);
console.log(
  "\nwrote outline-svgs.js",
  Object.keys(out).length,
  "ok, missing",
  missing.length,
  "failed",
  failed.length,
  "bytes",
  js.length
);
