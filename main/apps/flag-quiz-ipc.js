const {
  setupLocalAuthApp,
  requireSignedIn,
  userStorageRoot,
  registerLegacyMigrator,
  registerSingleFileMigrator,
} = require("./local-auth-app-helper");

const APP_ID = "flag-quiz";
const auth = setupLocalAuthApp(APP_ID);
registerSingleFileMigrator(APP_ID, "flag-quiz-scores.json");

const DATA_FILE = () => auth.userDataPath("data.json");

function signedInGuard() {
  return requireSignedIn(auth);
}


const { app } = require("electron");
const fs = require("fs");
const path = require("path");
const { publishScreenFacts, getScreenFacts } = require("../ai/screen-facts-store");

function scoresPath() {
  return path.join(app.getPath("userData"), "flag-quiz-scores.json");
}

function loadScores() {
  try {
    const raw = JSON.parse(fs.readFileSync(scoresPath(), "utf8"));
    return Array.isArray(raw?.scores) ? raw.scores : [];
  } catch {
    return [];
  }
}

function saveScores(scores) {
  fs.mkdirSync(path.dirname(scoresPath()), { recursive: true });
  fs.writeFileSync(scoresPath(), JSON.stringify({ scores }, null, 2), "utf8");
}

async function handleFlagQuizInvoke(channel, args = {}) {
  const authErr = signedInGuard();
  if (authErr) return authErr;
  switch (channel) {
    case "scores.list":
      return { ok: true, scores: loadScores().slice(0, 50) };
    case "scores.add": {
      const entry = {
        score: Number(args.score) || 0,
        total: Number(args.total) || 0,
        pct: Number(args.pct) || 0,
        at: Date.now(),
      };
      const scores = [entry, ...loadScores()].slice(0, 50);
      saveScores(scores);
      return { ok: true, scores };
    }
    case "scores.clear":
      saveScores([]);
      return { ok: true, scores: [] };
    case "screen.publish": {
      publishScreenFacts("flag-quiz", args || {});
      return { ok: true };
    }
    case "screen.get":
      return { ok: true, facts: getScreenFacts("flag-quiz") };
    case "meta":
      return {
        ok: true,
        name: "Learning Games",
        version: "2.0.0",
        defaultQuestions: 12,
        categories: ["countries"],
      };
    default:
      return { ok: false, error: `Unknown flag-quiz channel: ${channel}` };
  }
}

module.exports = { handleFlagQuizInvoke };