function scheduleCard(card, grade) {
  const next = {
    ...card,
    updatedAt: new Date().toISOString(),
    reps: (card.reps || 0) + 1,
  };
  const now = Date.now();
  let ease = Number(card.ease) || 2.5;
  let interval = Number(card.interval) || 0;

  if (grade === "again") {
    next.lapses = (card.lapses || 0) + 1;
    ease = Math.max(1.3, ease - 0.2);
    interval = 0;
    next.dueAt = new Date(now + 5 * 60 * 1000).toISOString();
  } else if (grade === "hard") {
    ease = Math.max(1.3, ease - 0.15);
    interval = interval ? Math.max(1, Math.round(interval * 1.2)) : 1;
    next.dueAt = new Date(now + interval * 24 * 60 * 60 * 1000).toISOString();
  } else if (grade === "easy") {
    ease = Math.min(3.0, ease + 0.15);
    interval = interval ? Math.round(interval * ease * 1.3) : 4;
    next.dueAt = new Date(now + interval * 24 * 60 * 60 * 1000).toISOString();
  } else {
    ease = Math.min(3.0, ease + 0.05);
    interval = interval ? Math.round(interval * ease) : 1;
    next.dueAt = new Date(now + interval * 24 * 60 * 60 * 1000).toISOString();
  }
  next.ease = Math.round(ease * 100) / 100;
  next.interval = interval;
  return next;
}

function dueQueue(cards, now = Date.now(), limit = 50) {
  const t = Number(now);
  return (Array.isArray(cards) ? cards : [])
    .map((card) => {
      const due = card?.dueAt != null ? Date.parse(card.dueAt) : 0;
      return { card, due: Number.isFinite(due) ? due : 0 };
    })
    .filter((row) => row.due <= t)
    .sort((a, b) => a.due - b.due)
    .slice(0, Math.max(1, limit))
    .map((row) => row.card);
}

function newCard(fields = {}) {
  const now = new Date().toISOString();
  return {
    id: fields.id || "card_" + Date.now(),
    front: String(fields.front || ""),
    back: String(fields.back || ""),
    type: fields.type || "flash",
    ease: 2.5,
    interval: 0,
    dueAt: now,
    reps: 0,
    lapses: 0,
    createdAt: now,
    updatedAt: now,
    ...fields,
  };
}

const api = { scheduleCard, dueQueue, newCard };
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.PartsCardsSrs = api;