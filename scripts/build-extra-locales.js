const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = path.join(__dirname, "..");
const LOCALE_DIR = path.join(ROOT, "apps", "shared", "i18n", "locales");
const TARGETS = ["ar", "fr", "ru", "es"];

function loadLocale(lang) {
  const p = path.join(LOCALE_DIR, `${lang}.js`);
  if (!fs.existsSync(p)) return {};
  delete require.cache[require.resolve(p)];
  require(p);
  return { ...(globalThis.MySpaceI18nMessages?.[lang] || {}) };
}

function wrap(lang, obj) {
  const sorted = {};
  for (const k of Object.keys(obj).sort()) sorted[k] = obj[k];
  return `(function (root) {
  const messages = ${JSON.stringify(sorted, null, 2)};
  root.MySpaceI18nMessages = root.MySpaceI18nMessages || {};
  root.MySpaceI18nMessages.${lang} = messages;
  if (typeof module !== "undefined" && module.exports) module.exports = messages;
})(typeof globalThis !== "undefined" ? globalThis : window);
`;
}

function save(lang, obj) {
  fs.writeFileSync(path.join(LOCALE_DIR, `${lang}.js`), wrap(lang, obj));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "MySpaceOS/1.0" }, timeout: 20000 }, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, json: JSON.parse(data) });
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

function keepAsIs(text) {
  const s = String(text || "");
  if (!s.trim()) return true;
  if (/^[a-z][a-z0-9_-]*\([^)]*\)/i.test(s) && s.length < 100) return true;
  return false;
}

async function translateOne(text, lang) {
  const url =
    "https://api.mymemory.translated.net/get?q=" +
    encodeURIComponent(text.slice(0, 450)) +
    `&langpair=en|${lang}`;
  const { json } = await getJson(url);
  const out = json?.responseData?.translatedText;
  if (!out || /MYMEMORY WARNING/i.test(out)) throw new Error(out || "empty");
  return out;
}

async function buildLang(lang, en) {
  const out = loadLocale(lang);
  const keys = Object.keys(en);
  for (const k of keys) if (out[k] == null) out[k] = en[k];
  const todo = keys.filter((k) => out[k] === en[k] && !keepAsIs(en[k]));
  console.log(`[${lang}] remaining ${todo.length}`);
  let done = 0;
  for (const k of todo) {
    try {
      out[k] = await translateOne(en[k], lang);
      done++;
    } catch (err) {
      console.warn(`[${lang}] ${k}:`, String(err.message || err).slice(0, 120));
      await sleep(2000);
    }
    if (done % 20 === 0 && done > 0) {
      save(lang, out);
      process.stdout.write(`[${lang}] ${done}/${todo.length}\n`);
    }
    await sleep(350);
  }
  save(lang, out);
  console.log(`[${lang}] complete`);
}

async function main() {
  const en = loadLocale("en");
  console.log("en", Object.keys(en).length);
  for (const lang of TARGETS) {
    const cur = loadLocale(lang);
    for (const k of Object.keys(en)) if (cur[k] == null) cur[k] = en[k];
    save(lang, cur);
  }
  for (const lang of TARGETS) {
    await buildLang(lang, en);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});