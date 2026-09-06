(() => {
  const PI = String(window.PI_DIGITS || "");
  const HINTS = window.PI_CHUNK_HINTS || {};
  const WORDS = window.DIGIT_WORDS || [];
  const DEFAULT_CHUNK = 4;

  const PHASES = [
    { id: "warm", label: "Warm-up" },
    { id: "study", label: "Study" },
    { id: "copy", label: "Copy" },
    { id: "recall", label: "Recall" },
    { id: "link", label: "Link" },
  ];

  const api = () => window.myApp;

  let progress = defaultProgress();
  let lesson = null;
  let recite = null;
  let reciteClockId = null;
  let inputLocked = false;

  function defaultProgress() {
    return {
      masteredDigits: 0,
      personalBest: { chain: 0, race: 0, ghost: 0, gaps: 0, chunk: 0, reciteStart: null },
      breakpoint: 0,
      targetDigits: 280,
      chunks: {},
      weakDigits: {},
      daily: {
        date: todayKey(),
        newDigits: 0,
        reviews: 0,
        streakDays: 0,
        lastActive: "",
      },
      history: [],
    };
  }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function normalizeReciteRecord(raw) {
    if (!raw || typeof raw !== "object") return null;
    const digits = Math.max(0, Number(raw.digits) || 0);
    const rate = Number(raw.rate);
    const seconds = Number(raw.seconds);
    const misses = Math.max(0, Number(raw.misses) || 0);
    if (!(digits > 0) || !Number.isFinite(rate) || rate <= 0) return null;
    return {
      digits,
      rate,
      seconds: Number.isFinite(seconds) ? seconds : rate * digits,
      misses,
      at: raw.at || "",
    };
  }

  function formatReciteRate(rate) {
    if (!Number.isFinite(rate) || rate <= 0) return "—";
    return `${rate.toFixed(2)}s/digit`;
  }

  function formatClock(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function reciteMissLimit(digits) {
    return digits * 0.05;
  }

  function isReciteRanked(digits, misses) {
    if (!(digits > 0)) return false;
    return !(misses / digits > 0.05);
  }

  function scoreFromStartRun(digits, elapsedMs, misses) {
    const wall = Math.max(0, elapsedMs) / 1000;
    const seconds = wall + misses; 
    const rate = seconds / digits;
    return {
      digits,
      misses,
      wall,
      seconds,
      rate,
      ranked: isReciteRanked(digits, misses),
    };
  }

  function el(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function invoke(channel, args) {
    if (!api()?.invoke) return { ok: false };
    return api().invoke(channel, args);
  }

  function normalizeProgress(raw) {
    const base = defaultProgress();
    if (!raw || typeof raw !== "object") return base;
    const daily = { ...base.daily, ...(raw.daily || {}) };
    if (daily.date !== todayKey()) {
      if (daily.date) {
        const prev = new Date(`${daily.date}T12:00:00`);
        const now = new Date(`${todayKey()}T12:00:00`);
        const diff = Math.round((now - prev) / 86400000);
        daily.streakDays = diff === 1 ? (daily.streakDays || 0) + 1 : 0;
      }
      daily.date = todayKey();
      daily.newDigits = 0;
      daily.reviews = 0;
    }
    return {
      masteredDigits: Math.max(0, Number(raw.masteredDigits) || 0),
      personalBest: {
        ...base.personalBest,
        ...(raw.personalBest || {}),
        reciteStart: normalizeReciteRecord(raw.personalBest?.reciteStart),
      },
      breakpoint: Math.max(0, Number(raw.breakpoint) || 0),
      targetDigits: (() => {
        const n = Math.min(PI.length, Math.max(20, Number(raw.targetDigits) || 280));
        return n === 100 ? 280 : n; 
      })(),
      chunks: raw.chunks && typeof raw.chunks === "object" ? raw.chunks : {},
      weakDigits: raw.weakDigits && typeof raw.weakDigits === "object" ? raw.weakDigits : {},
      daily,
      history: Array.isArray(raw.history) ? raw.history.slice(0, 40) : [],
    };
  }

  async function loadProgress() {
    const res = await invoke("progress.get");
    progress = normalizeProgress(res?.progress);
  }

  async function saveProgress() {
    progress.daily.lastActive = todayKey();
    await invoke("progress.save", { progress });
    publishScreen();
  }

  function publishScreen() {
    invoke("screen.publish", {
      app: "pi-digits",
      masteredDigits: progress.masteredDigits,
      targetDigits: progress.targetDigits,
      breakpoint: progress.breakpoint,
      phase: lesson?.phase || null,
    }).catch(() => {});
  }

  function chunkSize() {
    const n = Number(window.AppSettingsRuntime?.get?.("defaultChunkSize"));
    return Number.isFinite(n) && n >= 3 && n <= 5 ? n : DEFAULT_CHUNK;
  }

  function targetDigits() {
    const n = Number(window.AppSettingsRuntime?.get?.("targetDigits"));
    if (Number.isFinite(n) && n >= 20) return Math.min(PI.length, n);
    return progress.targetDigits || 280;
  }

  function group(s, size = chunkSize()) {
    const re = new RegExp(`(\\d{${size}})(?=\\d)`, "g");
    return String(s).replace(re, "$1 ");
  }

  function setPage(page) {
    document.querySelectorAll(".page").forEach((p) => {
      p.hidden = p.dataset.page !== page;
    });
  }

  function speakDigits(digits) {
    try {
      window.speechSynthesis?.cancel();
      const text = [...String(digits)]
        .map((d) => WORDS[Number(d)] || d)
        .join(", ");
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.9;
      u.pitch = 1;
      window.speechSynthesis?.speak(u);
    } catch {
    }
  }

  function hintFor(start) {
    const h = HINTS[start];
    if (!h) return null;
    if (typeof h === "string") return { tip: h, story: h };
    return h;
  }

  function activePhases(includeWarm) {
    return includeWarm ? PHASES : PHASES.filter((p) => p.id !== "warm");
  }

  function renderHome() {
    const target = targetDigits();
    progress.targetDigits = target;
    const known = Math.min(progress.masteredDigits, target);
    const size = chunkSize();
    const next = PI.slice(known, Math.min(known + size, target));
    const ahead = PI.slice(known + next.length, Math.min(known + next.length + 8, target));

    el("pi-hero").innerHTML =
      `<span class="prefix">3.</span>` +
      `<span class="known">${escapeHtml(group(PI.slice(0, known)))}</span>` +
      (next ? `<span class="next">${escapeHtml(group(next))}</span>` : "") +
      (ahead ? `<span class="ahead">${escapeHtml(group(ahead))}</span>` : "");

    el("home-line").textContent =
      known >= target
        ? `Goal reached — ${known} digits locked in`
        : `You know ${known} of ${target} · next lesson learns ${next.length} new digits`;

    el("home-bar").style.width = `${Math.min(100, (known / target) * 100)}%`;

    const willWarm = known >= size;
    el("session-plan").textContent = next
      ? willWarm
        ? `Lesson path: warm-up → study → copy → recall → link into the sequence`
        : `Lesson path: study → copy → recall → link into π`
      : `Practice with Quick recite to keep it fresh`;

    const canLearn = known < target && known < PI.length;
    el("btn-learn").disabled = !canLearn;
    el("btn-learn").textContent =
      known === 0 ? "Start first lesson" : known >= target ? "Goal complete" : "Start lesson";

    el("btn-recite").hidden = known < size;
    el("btn-recite-start").hidden = known < size;
    el("btn-early").hidden = known < size;
    const weak = progress.breakpoint > 0 && progress.breakpoint < known;
    el("btn-review").hidden = !weak;
    if (weak) el("btn-review").textContent = `Review around digit ${progress.breakpoint + 1}`;

    const recordEl = el("recite-record");
    const best = progress.personalBest?.reciteStart;
    if (recordEl) {
      if (best && best.rate > 0) {
        recordEl.hidden = false;
        recordEl.textContent = `From-the-start best: ${formatReciteRate(best.rate)} · ${best.digits} digits${
          best.misses ? ` · ${best.misses} miss penalty` : ""
        }`;
      } else {
        recordEl.hidden = true;
        recordEl.textContent = "";
      }
    }

    setPage("home");
    publishScreen();
  }

  function buildPad(container, onDigit, onBack) {
    container.innerHTML = "";
    container.hidden = false;
    for (let d = 0; d <= 9; d++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "digit-key";
      b.textContent = String(d);
      b.addEventListener("click", () => onDigit(String(d)));
      container.appendChild(b);
    }
    const back = document.createElement("button");
    back.type = "button";
    back.className = "digit-key wide";
    back.textContent = "⌫";
    back.addEventListener("click", onBack);
    container.appendChild(back);
  }

  function startLesson(opts = {}) {
    const size = chunkSize();
    const target = targetDigits();
    let start =
      opts.start != null
        ? opts.start
        : Math.floor(progress.masteredDigits / size) * size;

    if (opts.review && progress.breakpoint < progress.masteredDigits) {
      start = Math.floor(progress.breakpoint / size) * size;
    }

    start = Math.max(0, Math.min(start, Math.max(0, target - 1)));
    start = Math.floor(start / size) * size;

    if (opts.early && start >= progress.masteredDigits) {
      renderHome();
      return;
    }

    if (start >= target || start >= PI.length) {
      renderHome();
      return;
    }

    const endAt = opts.early
      ? Math.min(start + size, progress.masteredDigits, target, PI.length)
      : Math.min(start + size, target, PI.length);
    const digits = PI.slice(start, endAt);
    if (!digits.length) {
      renderHome();
      return;
    }    const includeWarm =
      !opts.skipWarm &&
      !opts.early &&
      start >= size &&
      progress.masteredDigits >= size;
    const warmDigits = includeWarm ? PI.slice(start - size, start) : "";

    lesson = {
      start,
      digits,
      warmDigits,
      phases: activePhases(includeWarm).map((p) => p.id),
      phaseIndex: 0,
      phase: activePhases(includeWarm)[0].id,
      typed: "",
      cursor: 0,
      misses: 0,
      isReview: Boolean(opts.review || opts.early),
      isEarly: Boolean(opts.early),
      locked: false,
    };

    inputLocked = false;
    renderLesson();
    setPage("learn");
  }

  function currentPhaseMeta() {
    return PHASES.find((p) => p.id === lesson?.phase) || PHASES[1];
  }

  function renderPhaseDots() {
    if (!lesson) return;
    el("phase-dots").innerHTML = lesson.phases
      .map((id, i) => {
        let cls = "phase-dot";
        if (i < lesson.phaseIndex) cls += " done";
        if (i === lesson.phaseIndex) cls += " now";
        return `<span class="${cls}" title="${escapeHtml(id)}"></span>`;
      })
      .join("");
  }

  function renderChips(digits, mode, typed = "", cursor = 0) {
    const parts = [];
    for (let i = 0; i < digits.length; i++) {
      let cls = "chip";
      let text = "";
      if (mode === "show") {
        cls += " show";
        text = digits[i];
      } else if (mode === "empty") {
        cls += i === cursor ? " empty active" : " empty";
        text = i < typed.length ? typed[i] : "·";
        if (i < typed.length) {
          cls = "chip filled" + (i === cursor - 1 ? "" : "");
          text = typed[i];
        }
        if (i === cursor) cls = "chip empty active";
      } else if (mode === "live") {
        if (i < typed.length) {
          const ok = typed[i] === digits[i];
          cls += ok ? " ok" : " bad";
          text = typed[i];
        } else if (i === cursor) {
          cls += " empty active";
          text = "·";
        } else {
          cls += " empty";
          text = "·";
        }
      }
      parts.push(
        `<span class="${cls}" style="animation-delay:${i * 0.05}s">${escapeHtml(text)}</span>`
      );
    }
    return parts.join("");
  }

  function renderPrefix(start) {
    const size = chunkSize();
    const from = Math.max(0, start - size);
    if (from >= start) {
      el("prefix-row").hidden = true;
      return;
    }
    const prefix = PI.slice(from, start);
    el("prefix-row").hidden = false;
    el("prefix-row").innerHTML = [...prefix]
      .map((d) => `<span class="chip">${escapeHtml(d)}</span>`)
      .join("");
  }

  function setFeedback(msg, kind) {
    const f = el("feedback");
    if (!msg) {
      f.hidden = true;
      return;
    }
    f.hidden = false;
    f.className = `feedback ${kind || ""}`;
    f.textContent = msg;
  }

  function renderLesson() {
    if (!lesson) return;
    const { phase, digits, warmDigits, start, typed, cursor } = lesson;
    const meta = currentPhaseMeta();
    renderPhaseDots();
    el("learn-step").textContent = `${meta.label} · ${lesson.phaseIndex + 1}/${lesson.phases.length}`;
    el("btn-skip-warm").hidden = phase !== "warm";
    el("btn-hear").hidden = !(phase === "study" || phase === "copy" || phase === "warm");

    const hint = hintFor(start);
    const story = el("story");

    if (phase === "warm") {
      el("prefix-row").hidden = true;
      el("chips").innerHTML = renderChips(warmDigits, "live", typed, cursor);
      story.hidden = true;
      el("coach").textContent = "Warm-up: type the previous chunk from memory. This keeps the chain alive.";
      el("btn-primary").hidden = true;
      buildPad(el("digit-pad"), onLessonDigit, onLessonBack);
      setFeedback("", "");
      return;
    }

    if (phase === "study") {
      el("prefix-row").hidden = true;
      el("chips").innerHTML = renderChips(digits, "show");
      if (hint?.story) {
        story.hidden = false;
        story.textContent = hint.story;
      } else {
        story.hidden = true;
      }
      el("coach").textContent =
        "Look carefully. Say each digit out loud (or tap Hear it). Build a tiny picture in your head, then continue.";
      el("digit-pad").hidden = true;
      el("btn-primary").hidden = false;
      el("btn-primary").textContent = "I studied it — next";
      setFeedback("", "");
      return;
    }

    if (phase === "copy") {
      el("prefix-row").hidden = false;
      el("prefix-row").innerHTML = [...digits]
        .map((d) => `<span class="chip show">${escapeHtml(d)}</span>`)
        .join("");
      el("chips").innerHTML = renderChips(digits, "live", typed, cursor);
      story.hidden = true;
      el("coach").textContent = "Copy phase: type the digits shown above. This wires eyes → fingers.";
      el("btn-primary").hidden = true;
      buildPad(el("digit-pad"), onLessonDigit, onLessonBack);
      setFeedback("", "");
      return;
    }

    if (phase === "recall") {
      el("prefix-row").hidden = true;
      el("chips").innerHTML = renderChips(digits, "live", typed, cursor);
      if (hint?.tip) {
        story.hidden = false;
        story.textContent = `Hint available: ${hint.tip} — try without it first.`;
      } else story.hidden = true;
      el("coach").textContent = "Recall: empty slots. Type from memory. Wrong digit? You’ll see the fix, then continue.";
      el("btn-primary").hidden = true;
      buildPad(el("digit-pad"), onLessonDigit, onLessonBack);
      setFeedback("", "");
      return;
    }

    if (phase === "link") {
      renderPrefix(start);
      el("chips").innerHTML = renderChips(digits, "live", typed, cursor);
      story.hidden = true;
      el("coach").textContent =
        "Link: the digits above are already yours. Type the new chunk so it attaches to the sequence.";
      el("btn-primary").hidden = true;
      buildPad(el("digit-pad"), onLessonDigit, onLessonBack);
      setFeedback("", "");
    }
  }

  function advancePhase() {
    if (!lesson) return;
    lesson.phaseIndex += 1;
    lesson.typed = "";
    lesson.cursor = 0;
    if (lesson.phaseIndex >= lesson.phases.length) {
      finishLesson();
      return;
    }
    lesson.phase = lesson.phases[lesson.phaseIndex];
    renderLesson();
    publishScreen();
  }

  async function finishLesson() {
    const { start, digits, misses, isReview, isEarly } = lesson;
    const end = start + digits.length;
    const size = digits.length;

    if (!isReview && start <= progress.masteredDigits) {
      const gained = Math.max(0, end - progress.masteredDigits);
      progress.masteredDigits = Math.max(progress.masteredDigits, end);
      progress.daily.newDigits = (progress.daily.newDigits || 0) + gained;
    }

    progress.chunks[String(start)] = {
      size: digits.length,
      reps: (progress.chunks[String(start)]?.reps || 0) + 1,
      misses,
      dueAt: new Date(Date.now() + (misses ? 2 : 24) * 3600 * 1000).toISOString(),
    };

    if (end >= progress.breakpoint) progress.breakpoint = end;
    progress.personalBest.chunk = Math.max(progress.personalBest.chunk || 0, progress.masteredDigits);
    progress.history.unshift({
      at: new Date().toISOString(),
      mode: isEarly ? "early" : "chunk",
      score: digits.length,
      length: digits.length,
    });
    progress.history = progress.history.slice(0, 40);
    progress.daily.reviews = (progress.daily.reviews || 0) + 1;
    await saveProgress();

    const nextEarly = end < progress.masteredDigits ? end : null;

    el("done-title").textContent = isEarly
      ? `Early chunk ${Math.floor(start / size) + 1} reinforced`
      : isReview
        ? "Chunk reinforced"
        : `+${digits.length} digits locked`;
    el("done-line").textContent = `You know ${progress.masteredDigits} of ${targetDigits()} · ${
      misses ? `${misses} correction${misses > 1 ? "s" : ""} this lesson` : "clean lesson"
    }`;
    el("done-chips").innerHTML = renderChips(digits, "show");

    const nextBtn = el("btn-done-next");
    if (isEarly && nextEarly != null) {
      nextBtn.textContent = "Next early chunk";
      nextBtn.dataset.nextEarly = String(nextEarly);
      nextBtn.dataset.mode = "early";
    } else if (isEarly) {
      nextBtn.textContent = "Back to learning new";
      nextBtn.dataset.nextEarly = "";
      nextBtn.dataset.mode = "learn";
    } else {
      nextBtn.textContent = "Next lesson";
      nextBtn.dataset.nextEarly = "";
      nextBtn.dataset.mode = "learn";
    }

    lesson = null;
    setPage("done");
  }

  function targetForPhase() {
    if (!lesson) return "";
    if (lesson.phase === "warm") return lesson.warmDigits;
    return lesson.digits;
  }

  function onLessonDigit(d) {
    if (!lesson || inputLocked) return;
    if (lesson.phase === "study") return;

    const target = targetForPhase();
    if (lesson.cursor >= target.length) return;

    const expected = target[lesson.cursor];
    const i = lesson.cursor;

    if (lesson.phase === "copy") {
      if (d !== expected) {
        lesson.misses += 1;
        flashBadAndRetry(i, expected, d);
        return;
      }
      lesson.typed += d;
      lesson.cursor += 1;
      renderLesson();
      if (lesson.cursor >= target.length) {
        setFeedback("Copied cleanly", "ok");
        setTimeout(() => advancePhase(), 500);
      }
      return;
    }

    if (d === expected) {
      lesson.typed += d;
      lesson.cursor += 1;
      renderLesson();
      if (lesson.cursor >= target.length) {
        setFeedback(lesson.phase === "warm" ? "Warm-up clear" : "Got it", "ok");
        setTimeout(() => advancePhase(), 550);
      }
      return;
    }

    lesson.misses += 1;
    markWeak(lesson.phase === "warm" ? lesson.start - target.length + i : lesson.start + i);
    progress.breakpoint = lesson.phase === "warm" ? lesson.start - target.length + i : lesson.start + i;
    saveProgress();
    flashBadAndRetry(i, expected, d);
  }

  function flashBadAndRetry(index, expected, typed) {
    inputLocked = true;
    const list = el("chips").querySelectorAll(".chip");
    const chip = list[index];
    if (chip) {
      chip.className = "chip bad";
      chip.textContent = typed;
    }
    setFeedback(`That slot is ${expected}: try again from here`, "bad");

    setTimeout(() => {
      if (chip) {
        chip.className = "chip reveal";
        chip.textContent = expected;
      }
      setTimeout(() => {
        lesson.typed = lesson.typed.slice(0, index);
        lesson.cursor = index;
        inputLocked = false;
        renderLesson();
        setFeedback("Continue from the highlighted slot", "bad");
      }, 700);
    }, 450);
  }

  function onLessonBack() {
    if (!lesson || inputLocked) return;
    if (lesson.phase === "study") return;
    if (lesson.cursor <= 0) return;
    lesson.cursor -= 1;
    lesson.typed = lesson.typed.slice(0, -1);
    renderLesson();
  }

  function markWeak(index) {
    if (index < 0) return;
    progress.weakDigits[index] = (progress.weakDigits[index] || 0) + 1;
  }

  function stopReciteClock() {
    if (reciteClockId) {
      clearInterval(reciteClockId);
      reciteClockId = null;
    }
  }

  function startReciteClock() {
    stopReciteClock();
    reciteClockId = setInterval(() => {
      if (!recite || recite.mode !== "fromStart") {
        stopReciteClock();
        return;
      }
      updateReciteStats();
    }, 100);
  }

  function updateReciteStats() {
    const stats = el("recite-stats");
    if (!stats || !recite || recite.mode !== "fromStart") {
      if (stats) stats.hidden = true;
      return;
    }
    const { from, end, cursor, startedAt, misses, finished } = recite;
    const digits = end - from;
    const missCap = reciteMissLimit(digits);
    const elapsedMs = startedAt ? Date.now() - startedAt : 0;
    const wall = formatClock(elapsedMs);
    const penalized = (elapsedMs / 1000 + (misses || 0)).toFixed(1);
    const over = (misses || 0) > missCap;
    const pace =
      startedAt && cursor > from
        ? formatReciteRate((elapsedMs / 1000 + (misses || 0)) / (cursor - from))
        : "—";

    stats.hidden = false;
    stats.innerHTML =
      `<span>${wall}</span>` +
      ` · <span>${cursor - from}/${digits}</span>` +
      ` · <span class="${over ? "miss-warn" : ""}">${misses || 0} miss${(misses || 0) === 1 ? "" : "es"} (+${misses || 0}s)</span>` +
      ` · <span class="${finished && !over ? "pace-good" : ""}">${finished ? "final " : "pace "}${pace}</span>` +
      (over ? ` · <span class="miss-warn">over 5%: won't rank</span>` : "");
  }

  function finishFromStartRun() {
    if (!recite || recite.mode !== "fromStart" || recite.finished) return;
    recite.finished = true;
    stopReciteClock();

    const digits = recite.end - recite.from;
    const elapsedMs = recite.startedAt ? Date.now() - recite.startedAt : 0;
    const score = scoreFromStartRun(digits, elapsedMs, recite.misses || 0);
    progress.personalBest.chain = Math.max(progress.personalBest.chain || 0, recite.end);

    const fb = el("recite-feedback");
    fb.hidden = false;

    if (!score.ranked) {
      fb.className = "feedback bad";
      fb.textContent =
        `Done — ${digits} digits in ${formatReciteRate(score.rate)} ` +
        `(${score.wall.toFixed(1)}s + ${score.misses}s miss penalty). ` +
        `Too many misses (${score.misses}/${digits} > 5%): not ranked.`;
      updateReciteStats();
      saveProgress();
      return;
    }

    const prev = progress.personalBest.reciteStart;
    const isNew =
      !prev ||
      score.rate < prev.rate - 1e-9 ||
      (Math.abs(score.rate - prev.rate) < 1e-9 && score.digits > (prev.digits || 0));

    if (isNew) {
      progress.personalBest.reciteStart = {
        digits: score.digits,
        rate: score.rate,
        seconds: score.seconds,
        misses: score.misses,
        at: new Date().toISOString(),
      };
    }

    fb.className = "feedback ok";
    fb.textContent = isNew
      ? `New record! ${formatReciteRate(score.rate)} on ${digits} digits ` +
        `(${score.wall.toFixed(1)}s + ${score.misses}s miss).`
      : `Full chain — ${formatReciteRate(score.rate)} on ${digits} digits ` +
        `(${score.wall.toFixed(1)}s + ${score.misses}s miss). Best stays ${formatReciteRate(prev.rate)}.`;

    updateReciteStats();
    saveProgress();
  }

  function startRecite(opts = {}) {
    const known = progress.masteredDigits;
    if (known <= 0) return;
    const size = chunkSize();
    const fromStart = opts.mode === "fromStart";
    let from;
    const end = known;
    if (fromStart) {
      from = 0;
    } else {
      const windowSize = Math.min(known, Math.max(size * 3, 12));
      from = Math.max(0, known - windowSize);
    }
    stopReciteClock();
    recite = {
      from,
      end,
      cursor: from,
      typed: "",
      mode: fromStart ? "fromStart" : "recent",
      startedAt: null,
      misses: 0,
      finished: false,
    };
    el("recite-feedback").hidden = true;
    const stats = el("recite-stats");
    if (stats) {
      stats.hidden = !fromStart;
      stats.textContent = fromStart
        ? `0:00 · 0/${end} · 0 misses · Timer starts on first digit`
        : "";
    }
    syncReciteModeButton();
    renderRecite();
    buildPad(el("recite-pad"), onReciteDigit, onReciteBack);
    setPage("recite");
    if (fromStart) startReciteClock();
  }

  function syncReciteModeButton() {
    const btn = el("btn-recite-mode");
    if (!recite || !btn) return;
    if (recite.mode === "fromStart") {
      el("recite-label").textContent = "Recite from the start";
      btn.textContent = "Switch to recent";
    } else {
      el("recite-label").textContent = "Recite recent";
      btn.textContent = "From the start";
    }
  }

  function renderRecite() {
    if (!recite) return;
    const { from, end, cursor, mode } = recite;
    const left = end - cursor;
    const size = chunkSize();

    const windowBack = mode === "fromStart" ? Math.max(size * 2, 8) : end - from;
    const windowAhead = mode === "fromStart" ? size : end - from;
    const viewFrom = mode === "fromStart" ? Math.max(from, cursor - windowBack) : from;
    const viewEnd =
      mode === "fromStart" ? Math.min(end, Math.max(cursor + windowAhead, viewFrom + size)) : end;

    el("recite-prefix").hidden = false;
    if (viewFrom === 0) {
      el("recite-prefix").innerHTML = `<span class="chip show">3.</span>`;
    } else {
      el("recite-prefix").innerHTML =
        `<span class="chip">…</span>` +
        [...PI.slice(Math.max(0, viewFrom - size), viewFrom)]
          .map((d) => `<span class="chip">${escapeHtml(d)}</span>`)
          .join("");
    }

    let html = "";
    for (let abs = viewFrom; abs < viewEnd; abs++) {
      let cls = "chip";
      let text = "·";
      if (abs < cursor) {
        cls += " ok";
        text = PI[abs];
      } else if (abs === cursor) {
        cls += " empty active";
      } else {
        cls += " empty";
      }
      html += `<span class="${cls}" data-abs="${abs}">${escapeHtml(text)}</span>`;
    }
    el("recite-chips").innerHTML = html;

    if (left <= 0) {
      el("recite-coach").textContent =
        mode === "fromStart"
          ? `Full run complete — all ${end} digits you know.`
          : "Nice — recent stretch complete.";
    } else if (mode === "fromStart") {
      el("recite-coach").textContent = `From the start · digit ${cursor + 1} of ${end}`;
    } else {
      el("recite-coach").textContent = `Recent ${end - from} digits · ${left} left`;
    }

    if (mode === "fromStart") updateReciteStats();
    else {
      const stats = el("recite-stats");
      if (stats) stats.hidden = true;
    }
  }

  function onReciteDigit(d) {
    if (!recite || recite.finished) return;
    const { cursor, end, mode } = recite;
    if (cursor >= end) return;

    if (mode === "fromStart" && !recite.startedAt) {
      recite.startedAt = Date.now();
    }

    if (d === PI[cursor]) {
      recite.cursor += 1;
      el("recite-feedback").hidden = true;
      renderRecite();
      if (recite.cursor >= end) {
        if (mode === "fromStart") finishFromStartRun();
        else {
          el("recite-feedback").hidden = false;
          el("recite-feedback").className = "feedback ok";
          el("recite-feedback").textContent = "Recent stretch cleared";
          progress.personalBest.chain = Math.max(progress.personalBest.chain || 0, end);
          saveProgress();
        }
      }
      return;
    }

    if (mode === "fromStart") {
      recite.misses = (recite.misses || 0) + 1;
      updateReciteStats();
    }
    progress.breakpoint = cursor;
    markWeak(cursor);
    saveProgress();
    el("recite-feedback").hidden = false;
    el("recite-feedback").className = "feedback bad";
    el("recite-feedback").textContent =
      mode === "fromStart"
        ? `Miss at digit ${cursor + 1} (+1s). It was ${PI[cursor]}.`
        : `Miss at digit ${cursor + 1}. It was ${PI[cursor]}.`;
    const chip = el("recite-chips").querySelector(`.chip[data-abs="${cursor}"]`);
    if (chip) {
      chip.className = "chip reveal";
      chip.textContent = PI[cursor];
    }
  }

  function onReciteBack() {
    if (!recite || recite.finished || recite.cursor <= recite.from) return;
    recite.cursor -= 1;
    el("recite-feedback").hidden = true;
    renderRecite();
  }

  el("btn-learn").addEventListener("click", () => startLesson());
  el("btn-review").addEventListener("click", () => startLesson({ review: true }));
  el("btn-early").addEventListener("click", () =>
    startLesson({ early: true, start: 0, skipWarm: true })
  );
  el("btn-recite").addEventListener("click", () => startRecite({ mode: "recent" }));
  el("btn-recite-start").addEventListener("click", () => startRecite({ mode: "fromStart" }));
  el("btn-recite-mode").addEventListener("click", () => {
    if (!recite) return;
    startRecite({ mode: recite.mode === "fromStart" ? "recent" : "fromStart" });
  });
  el("btn-learn-back").addEventListener("click", () => {
    lesson = null;
    window.speechSynthesis?.cancel();
    renderHome();
  });
  el("btn-recite-back").addEventListener("click", () => {
    stopReciteClock();
    recite = null;
    renderHome();
  });
  el("btn-recite-done").addEventListener("click", () => {
    stopReciteClock();
    recite = null;
    renderHome();
  });
  el("btn-done-home").addEventListener("click", () => renderHome());
  el("btn-done-next").addEventListener("click", () => {
    const mode = el("btn-done-next").dataset.mode;
    const nextEarly = el("btn-done-next").dataset.nextEarly;
    if (mode === "early" && nextEarly !== "") {
      startLesson({ early: true, start: Number(nextEarly), skipWarm: true });
      return;
    }
    startLesson();
  });

  el("btn-primary").addEventListener("click", () => {
    if (!lesson) return;
    if (lesson.phase === "study") advancePhase();
  });

  el("btn-hear").addEventListener("click", () => {
    if (!lesson) return;
    speakDigits(lesson.phase === "warm" ? lesson.warmDigits : lesson.digits);
  });

  el("btn-skip-warm").addEventListener("click", () => {
    if (!lesson || lesson.phase !== "warm") return;
    advancePhase();
  });

  document.addEventListener("keydown", (e) => {
    const page = [...document.querySelectorAll(".page")].find((p) => !p.hidden)?.dataset.page;
    if (page === "learn") {
      if (e.key === "Backspace") {
        e.preventDefault();
        onLessonBack();
      } else if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        onLessonDigit(e.key);
      } else if (e.key === "Enter" && lesson?.phase === "study") {
        e.preventDefault();
        advancePhase();
      }
    } else if (page === "recite") {
      if (e.key === "Backspace") {
        e.preventDefault();
        onReciteBack();
      } else if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        onReciteDigit(e.key);
      }
    }
  });

  document.addEventListener("app-settings-applied", () => {
    if (!el("page-home").hidden) renderHome();
  });
  document.addEventListener("app-setting-changed", (e) => {
    if (e.detail?.appId && e.detail.appId !== "pi-digits") return;
    if (!el("page-home").hidden) renderHome();
  });

  async function migrateTargetGoal() {
    try {
      const setting = Number(window.AppSettingsRuntime?.get?.("targetDigits"));
      if (setting === 100 && typeof window.AppSettings?.set === "function") {
        await window.AppSettings.set("targetDigits", 280);
        await window.AppSettingsRuntime?.load?.();
      }
      if (Number(progress.targetDigits) === 100) {
        progress.targetDigits = 280;
        await saveProgress();
      }
    } catch (_) {
      if (Number(progress?.targetDigits) === 100) progress.targetDigits = 280;
    }
  }

  async function boot() {
    await loadProgress();
    for (let i = 0; i < 20 && !window.AppSettingsRuntime?.isReady?.(); i += 1) {
      await new Promise((r) => setTimeout(r, 50));
    }
    await migrateTargetGoal();
    progress.targetDigits = targetDigits();
    renderHome();
  }

  boot();
})();