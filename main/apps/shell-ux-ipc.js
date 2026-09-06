const focusGate = require("./focus-gate");

async function widgetsSnapshot(opts = {}) {
  const symbols = Array.isArray(opts.symbols) && opts.symbols.length
    ? opts.symbols.map(String)
    : ["AAPL", "MSFT", "BTC-USD"];

  let nextTask = null;
  let todayCount = 0;
  try {
    const { handleDayPlannerInvoke } = require("./day-planner-ipc");
    const list = await handleDayPlannerInvoke("tasks.list", {});
    const today = list?.buckets?.today || [];
    todayCount = today.length;
    nextTask = today[0]
      ? {
          id: today[0].id,
          title: today[0].title,
          dueTime: today[0].dueTime || null,
          priority: today[0].priority || "normal",
        }
      : null;
  } catch {
  }

  let quotes = [];
  try {
    const { handleStocksInvoke } = require("./stocks-ipc");
    const res = await handleStocksInvoke("quote.get", { symbols });
    quotes = (res?.quotes || []).slice(0, 4).map((q) => ({
      symbol: q.symbol,
      price: q.price ?? q.regularMarketPrice ?? null,
      changePct: q.changePct ?? q.regularMarketChangePercent ?? null,
    }));
  } catch {
  }

  return {
    ok: true,
    at: new Date().toISOString(),
    nextTask,
    todayCount,
    quotes,
    focus: focusGate.getState(),
  };
}

async function markNextTaskDone() {
  const { handleDayPlannerInvoke } = require("./day-planner-ipc");
  const list = await handleDayPlannerInvoke("tasks.list", {});
  const next = list?.buckets?.today?.[0];
  if (!next) return { ok: false, error: "No open Today tasks" };
  return handleDayPlannerInvoke("task.toggle", { id: next.id });
}

async function addStudyCard(args = {}) {
  const { handleStudyDeckInvoke } = require("./study-deck-ipc");
  const decks = await handleStudyDeckInvoke("decks.list", {});
  const deckId = args.deckId || decks?.decks?.[0]?.id;
  if (!deckId) return { ok: false, error: "No Study Deck found" };
  const front = String(args.front || "").trim();
  const back = String(args.back || "").trim();
  if (!front) return { ok: false, error: "Front text is required" };
  return handleStudyDeckInvoke("card.add", {
    deckId,
    card: { front, back: back || "…" },
  });
}

async function handleShellUx(channel, args = {}) {
  switch (channel) {
    case "focus.get":
      return { ok: true, focus: focusGate.getState() };
    case "focus.enter":
      return focusGate.enter(args || {});
    case "focus.exit":
      return focusGate.exit();
    case "widgets.snapshot":
      return widgetsSnapshot(args || {});
    case "task.markNextDone":
      return markNextTaskDone();
    case "deck.addCard":
      return addStudyCard(args || {});
    default:
      return { ok: false, error: `Unknown shell-ux channel: ${channel}` };
  }
}

module.exports = { handleShellUx, widgetsSnapshot };
