const path = require("path");
const fs = require("fs");
const {
  buildLearnProfile,
  loadBundledLearn,
  saveBundledLearn,
  sleep,
} = require("../main/apps/geography-learn");
const { fetchAllCountries, fetchCountryDetail } = require("../main/apps/restcountries-client");

const PROGRESS_FILE = path.join(__dirname, "..", "data", "geography-learn-progress.json");

async function fetchCountryList() {
  const { countries } = await fetchAllCountries();
  return countries;
}

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf8"));
  } catch {
  }
  return { completed: [] };
}

function saveProgress(completed) {
  fs.mkdirSync(path.dirname(PROGRESS_FILE), { recursive: true });
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ completed, updatedAt: Date.now() }, null, 2), "utf8");
}

async function main() {
  const limit = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1]) || 0;
  const force = process.argv.includes("--force");

  const existing = loadBundledLearn();
  const progress = loadProgress();
  const doneSet = new Set(force ? [] : progress.completed || []);
  const profiles = force ? {} : { ...(existing.profiles || {}) };

  const countries = await fetchCountryList();
  const todo = countries.filter((c) => !doneSet.has(c.code));
  const slice = limit > 0 ? todo.slice(0, limit) : todo;

  console.log(`Countries: ${countries.length} | Done: ${doneSet.size} | To build: ${slice.length}\n`);

  for (let i = 0; i < slice.length; i++) {
    const c = slice[i];
    process.stdout.write(`[${i + 1}/${slice.length}] ${c.name} (${c.code})… `);
    try {
      const full = await fetchCountryDetail(c.code);
      const profile = await buildLearnProfile(full);
      profiles[c.code] = profile;
      doneSet.add(c.code);
      saveBundledLearn(path.join(__dirname, ".."), profiles);
      saveProgress([...doneSet]);
      const secCount = profile.sections?.length || 0;
      console.log(`✓ ${secCount} sections`);
    } catch (err) {
      console.log(`✗ ${err.message}`);
    }
    await sleep(350);
  }

  saveBundledLearn(path.join(__dirname, ".."), profiles);
  console.log(`\nDone. ${Object.keys(profiles).length} profiles in data/geography-learn.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});