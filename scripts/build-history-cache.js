const path = require("path");
const fs = require("fs");
const { buildWikiSeed } = require(path.join(__dirname, "../main/apps/history-wiki-seed"));

const OUT_PROJECT = path.join(__dirname, "..", "data", "history-cache.json");
const PROGRESS_FILE = path.join(__dirname, "..", "data", "history-build-progress.json");
const ERRORS_LOG = path.join(__dirname, "..", "data", "history-build-errors.log");
const TOTAL_SOURCES = 57;

function loadExisting() {
  try {
    if (fs.existsSync(OUT_PROJECT)) return JSON.parse(fs.readFileSync(OUT_PROJECT, "utf8"));
  } catch {
  }
  return null;
}

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf8"));
  } catch {
  }
  return { completedSources: [] };
}

function saveProgress(completedSources) {
  fs.mkdirSync(path.dirname(PROGRESS_FILE), { recursive: true });
  fs.writeFileSync(
    PROGRESS_FILE,
    JSON.stringify({ completedSources, updatedAt: Date.now() }, null, 2),
    "utf8"
  );
}

function saveCache(cache) {
  fs.mkdirSync(path.dirname(OUT_PROJECT), { recursive: true });
  fs.writeFileSync(OUT_PROJECT, JSON.stringify(cache, null, 2), "utf8");
  const appData = process.env.APPDATA;
  if (appData) {
    const userCache = path.join(appData, "my-space", "history-cache.json");
    try {
      fs.mkdirSync(path.dirname(userCache), { recursive: true });
      fs.copyFileSync(OUT_PROJECT, userCache);
    } catch {
    }
  }
}

async function runOnce() {
  const errors = [];
  const existing = loadExisting();
  const progressState = loadProgress();
  const done = progressState.completedSources?.length || 0;

  console.log(
    `Resume: ${existing?.figures?.length || 0} figures, ${existing?.events?.length || 0} events` +
      ` | ${done}/${TOTAL_SOURCES} sources done\n`
  );

  const cache = await buildWikiSeed(
    (p) => {
      if (p.skipped) {
        console.log(`[${p.step}/${p.total}] SKIP (done) ${p.phase}/${p.era}`);
        return;
      }
      const counts = p.figuresCount != null ? ` → ${p.figuresCount} fig, ${p.eventsCount} ev` : "";
      const saved = p.saved ? " ✓ saved" : "";
      console.log(`[${p.step}/${p.total}] ${p.phase}/${p.era} (${p.kind})${counts}${saved}`);
    },
    (era, phase, err, attempt) => {
      const line = `${phase}/${era} attempt ${attempt}: ${err.message}`;
      errors.push(line);
      console.warn("RETRY:", line);
    },
    (snapshot, prog) => {
      saveCache(snapshot);
      if (prog?.completedSources) saveProgress(prog.completedSources);
    },
    existing,
    progressState
  );

  saveCache(cache);
  const finalProgress = loadProgress();
  const allDone = (finalProgress.completedSources?.length || 0) >= TOTAL_SOURCES;

  if (errors.length) {
    fs.appendFileSync(ERRORS_LOG, `\n${new Date().toISOString()}\n${errors.join("\n")}\n`, "utf8");
  }

  const sizeMb = (fs.statSync(OUT_PROJECT).size / 1024 / 1024).toFixed(2);
  console.log(`\nPass done. Figures: ${cache.figures.length} | Events: ${cache.events.length} | ${sizeMb} MB`);
  console.log(`Sources completed: ${finalProgress.completedSources?.length || 0}/${TOTAL_SOURCES}`);

  return { cache, allDone, completed: finalProgress.completedSources?.length || 0 };
}

async function main() {
  let pass = 0;
  while (true) {
    pass += 1;
    console.log(`\n========== Build pass ${pass} ==========\n`);
    try {
      const { allDone, completed } = await runOnce();
      if (allDone) {
        console.log("\n✓ All sources complete. Build finished.");
        break;
      }
      console.log(`\n${TOTAL_SOURCES - completed} sources remaining: restarting in 30s…`);
      await new Promise((r) => setTimeout(r, 30000));
    } catch (err) {
      console.error("Pass crashed:", err.message, ": retrying in 60s…");
      await new Promise((r) => setTimeout(r, 60000));
    }
  }
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});