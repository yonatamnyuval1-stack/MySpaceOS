const { app } = require("electron");
const fs = require("fs");
const path = require("path");
const { publishScreenFacts, getScreenFacts } = require("../ai/screen-facts-store");

const {
  setupLocalAuthApp,
  requireSignedIn,
  userStorageRoot,
  registerLegacyMigrator,
  registerSingleFileMigrator,
} = require("./local-auth-app-helper");

const APP_ID = "pi-digits";
const auth = setupLocalAuthApp(APP_ID);
registerSingleFileMigrator(APP_ID, "pi-digits.json");

const DATA_FILE = () => auth.userDataPath("data.json");

function signedInGuard() {
  return requireSignedIn(auth);
}


function dataPath() {
  return DATA_FILE();
}

function defaultProgress() {
  return {
    masteredDigits: 0,
    personalBest: { chain: 0, race: 0, ghost: 0, gaps: 0, chunk: 0, reciteStart: null },
    breakpoint: 0,
    targetDigits: 280,
    chunks: {},
    weakDigits: {},
    daily: {
      date: new Date().toISOString().slice(0, 10),
      newDigits: 0,
      reviews: 0,
      streakDays: 0,
      lastActive: "",
    },
    history: [],
  };
}

function normalizeProgress(raw) {
  const base = defaultProgress();
  if (!raw || typeof raw !== "object") return base;
  return {
    masteredDigits: Math.max(0, Number(raw.masteredDigits) || 0),
    personalBest: (() => {
      const pb = { ...base.personalBest, ...(raw.personalBest || {}) };
      const rs = raw.personalBest?.reciteStart;
      if (rs && typeof rs === "object" && Number(rs.rate) > 0 && Number(rs.digits) > 0) {
        pb.reciteStart = {
          digits: Number(rs.digits),
          rate: Number(rs.rate),
          seconds: Number(rs.seconds) || Number(rs.rate) * Number(rs.digits),
          misses: Math.max(0, Number(rs.misses) || 0),
          at: rs.at || "",
        };
      } else {
        pb.reciteStart = null;
      }
      return pb;
    })(),
    breakpoint: Math.max(0, Number(raw.breakpoint) || 0),
    targetDigits: (() => {
      const n = Math.min(500, Math.max(20, Number(raw.targetDigits) || 280));
      return n === 100 ? 280 : n; 
    })(),
    chunks: raw.chunks && typeof raw.chunks === "object" ? raw.chunks : {},
    weakDigits: raw.weakDigits && typeof raw.weakDigits === "object" ? raw.weakDigits : {},
    daily: { ...base.daily, ...(raw.daily || {}) },
    history: Array.isArray(raw.history) ? raw.history.slice(0, 40) : [],
  };
}

function loadProgress() {
  try {
    const raw = JSON.parse(fs.readFileSync(dataPath(), "utf8"));
    return normalizeProgress(raw.progress || raw);
  } catch (err) {
    if (err && err.code === "ENOENT") return defaultProgress();
    return defaultProgress();
  }
}

function saveProgress(progress) {
  fs.mkdirSync(path.dirname(dataPath()), { recursive: true });
  fs.writeFileSync(
    dataPath(),
    JSON.stringify({ progress: normalizeProgress(progress), updatedAt: new Date().toISOString() }, null, 2),
    "utf8"
  );
}

async function handlePiDigitsInvoke(channel, args = {}) {
  const authErr = signedInGuard();
  if (authErr) return authErr;
  switch (channel) {
    case "progress.get":
      return { ok: true, progress: loadProgress() };
    case "progress.save": {
      const progress = normalizeProgress(args.progress);
      saveProgress(progress);
      return { ok: true, progress };
    }
    case "progress.reset":
      saveProgress(defaultProgress());
      return { ok: true, progress: defaultProgress() };
    case "screen.publish": {
      publishScreenFacts("pi-digits", args || {});
      return { ok: true };
    }
    case "screen.get":
      return { ok: true, facts: getScreenFacts("pi-digits") };
    case "meta":
      return {
        ok: true,
        name: "Pi Digits",
        version: "1.0.0",
        digitsAvailable: 500,
        defaultTarget: 280,
      };
    default:
      return { ok: false, error: `Unknown pi-digits channel: ${channel}` };
  }
}

module.exports = { handlePiDigitsInvoke };