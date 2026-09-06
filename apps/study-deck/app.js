(() => {
  const api = () => window.myApp;

  let decks = [];
  let activeDeckId = null;
  let studyQueue = [];
  let studyIndex = 0;
  let flipped = false;
  let sessionReviewed = 0;
  let answered = false;

  const DECK_COLORS = ["#1f6f5b", "#c45c26", "#2f5d8a", "#6b4f2a", "#3d6b4f", "#8a3d4a"];
  const TYPE_LABELS = {
    flash: "Flashcard",
    qa: "Q & A",
    quiz: "Quiz",
    truefalse: "True / False",
    cloze: "Fill blank",
  };

  function cardType(card) {
    return TYPE_LABELS[card?.type] ? card.type : "flash";
  }

  function isChoiceCard(card) {
    const t = cardType(card);
    return t === "quiz" || t === "truefalse";
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
    if (!api()?.invoke) throw new Error("Study Deck unavailable — restart My Space");
    return api().invoke(channel, args);
  }

  function activeDeck() {
    return decks.find((d) => d.id === activeDeckId) || null;
  }

  function setPage(page) {
    document.querySelectorAll(".page").forEach((p) => {
      const on = p.dataset.page === page;
      p.hidden = !on;
      p.classList.toggle("active", on);
    });
    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.page === page || (page === "deck" && btn.dataset.page === "home"));
    });
    el("topbar-home").classList.toggle("hidden", page !== "home");
    el("topbar-deck").classList.toggle("hidden", page !== "deck");
    const navStudy = el("nav-study");
    navStudy.disabled = !activeDeckId;

    if (page === "home") {
      el("page-title").textContent = "Decks";
      el("page-subtitle").textContent = "Build flashcard decks and practice what matters";
    } else if (page === "deck") {
      const d = activeDeck();
      el("page-title").textContent = d?.name || "Deck";
      el("page-subtitle").textContent = d?.description || "Cards in this deck";
    } else if (page === "study") {
      el("page-title").textContent = "Play";
      el("page-subtitle").textContent = activeDeck()?.name || "";
      el("topbar-home").classList.add("hidden");
      el("topbar-deck").classList.add("hidden");
    }
    publishScreen();
  }

  async function loadDecks() {
    const res = await invoke("decks.list");
    if (!res?.ok) throw new Error(res?.error || "Failed to load decks");
    decks = res.decks || [];
    renderHome();
    if (activeDeckId) {
      const still = decks.find((d) => d.id === activeDeckId);
      if (!still) activeDeckId = null;
      else await openDeck(activeDeckId, false);
    }
  }

  function renderHome() {
    const grid = el("deck-grid");
    const empty = el("home-empty");
    const stats = el("home-stats");
    const totalCards = decks.reduce((n, d) => n + (d.cardCount || d.cards?.length || 0), 0);
    const due = decks.reduce((n, d) => n + (d.dueCount || 0), 0);
    stats.innerHTML = `
      <span class="stat-chip">${decks.length} deck${decks.length === 1 ? "" : "s"}</span>
      <span class="stat-chip">${totalCards} cards</span>
      <span class="stat-chip">${due} due</span>
    `;
    if (!decks.length) {
      grid.innerHTML = "";
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    grid.innerHTML = decks
      .map((d) => {
        const count = d.cardCount ?? d.cards?.length ?? 0;
        const dueCount = d.dueCount ?? 0;
        return `
        <article class="deck-card" data-deck="${escapeHtml(d.id)}">
          <button type="button" class="deck-card-delete" data-delete="${escapeHtml(d.id)}" title="Delete deck" aria-label="Delete deck">✕</button>
          <button type="button" class="deck-card-open" data-open="${escapeHtml(d.id)}">
            <div class="deck-card-swatch" style="background:${escapeHtml(d.color || "#1f6f5b")}"></div>
            <h3>${escapeHtml(d.name)}</h3>
            <p>${escapeHtml(d.description || "No description")}</p>
            <div class="deck-card-meta">
              <span>${count} card${count === 1 ? "" : "s"}</span>
              <span>${dueCount} due</span>
            </div>
          </button>
        </article>`;
      })
      .join("");
    grid.querySelectorAll("[data-open]").forEach((btn) => {
      btn.addEventListener("click", () => openDeck(btn.dataset.open));
    });
    grid.querySelectorAll("[data-delete]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        deleteDeck(btn.dataset.delete);
      });
    });
  }

  async function openDeck(id, switchPage = true) {
    const res = await invoke("deck.get", { id });
    if (!res?.ok) throw new Error(res?.error || "Deck not found");
    activeDeckId = id;
    const idx = decks.findIndex((d) => d.id === id);
    if (idx >= 0) decks[idx] = { ...res.deck, cardCount: res.deck.cards.length };
    else decks.unshift({ ...res.deck, cardCount: res.deck.cards.length });
    renderDeck(res.deck);
    if (switchPage) setPage("deck");
    el("nav-study").disabled = false;
  }

  function renderDeck(deck) {
    const typeSummary = {};
    for (const c of deck.cards) {
      const t = cardType(c);
      typeSummary[t] = (typeSummary[t] || 0) + 1;
    }
    const mix = Object.entries(typeSummary)
      .map(([t, n]) => `${n} ${TYPE_LABELS[t] || t}`)
      .join(" · ");

    el("deck-meta").innerHTML = `
      <div>
        <h2>${escapeHtml(deck.name)}</h2>
        <p>${escapeHtml(deck.description || mix || `${deck.cards.length} cards · tap Play when ready`)}</p>
      </div>
      <button type="button" class="btn btn-danger" id="btn-delete-deck">Delete deck</button>
    `;
    el("btn-delete-deck").addEventListener("click", () => deleteDeck(deck.id));

    const list = el("card-list");
    const empty = el("deck-empty");
    if (!deck.cards.length) {
      list.innerHTML = "";
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    list.innerHTML = deck.cards
      .map((c) => {
        const t = cardType(c);
        const backPreview =
          t === "quiz"
            ? (c.choices || []).map((ch, i) => `${i === c.answerIndex ? "✓ " : ""}${ch}`).join(" · ")
            : c.back;
        return `
      <article class="card-row" data-card="${escapeHtml(c.id)}">
        <div>
          <strong>${escapeHtml(TYPE_LABELS[t] || t)} · prompt</strong>
          <div class="front">${escapeHtml(c.front)}</div>
        </div>
        <div>
          <strong>${t === "quiz" || t === "truefalse" ? "Choices / answer" : "Answer"}</strong>
          <div class="back">${escapeHtml(backPreview)}</div>
        </div>
        <div class="card-row-actions">
          <button type="button" class="btn btn-ghost" data-edit="${escapeHtml(c.id)}">Edit</button>
          <button type="button" class="btn btn-danger" data-del="${escapeHtml(c.id)}">Delete</button>
        </div>
      </article>`;
      })
      .join("");
    list.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const card = deck.cards.find((c) => c.id === btn.dataset.edit);
        if (card) openCardModal(card);
      });
    });
    list.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", () => deleteCard(btn.dataset.del));
    });
  }

  function openModal(html) {
    const modal = el("modal");
    el("modal-card").innerHTML = html;
    modal.classList.remove("hidden");
  }

  function closeModal() {
    el("modal").classList.add("hidden");
    el("modal-card").innerHTML = "";
  }

  function openDeckModal(existing) {
    const isEdit = Boolean(existing);
    openModal(`
      <h3>${isEdit ? "Edit deck" : "New deck"}</h3>
      <div class="field"><label>Name</label><input id="m-name" value="${escapeHtml(existing?.name || "")}" placeholder="e.g. Biology · Cell division" /></div>
      <div class="field"><label>Description</label><input id="m-desc" value="${escapeHtml(existing?.description || "")}" placeholder="Optional" /></div>
      <div class="field"><label>Language for AI</label>
        <select id="m-lang">
          <option value="en" ${existing?.language !== "he" ? "selected" : ""}>English</option>
          <option value="he" ${existing?.language === "he" ? "selected" : ""}>עברית</option>
        </select>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="m-cancel">Cancel</button>
        <button type="button" class="btn btn-primary" id="m-save">Save</button>
      </div>
    `);
    el("m-cancel").onclick = closeModal;
    el("m-save").onclick = async () => {
      const name = el("m-name").value.trim();
      if (!name) return;
      const payload = {
        name,
        description: el("m-desc").value.trim(),
        language: el("m-lang").value,
        color: existing?.color || DECK_COLORS[decks.length % DECK_COLORS.length],
      };
      if (isEdit) {
        await invoke("deck.update", { id: existing.id, ...payload });
      } else {
        const res = await invoke("deck.create", payload);
        if (res?.ok) activeDeckId = res.deck.id;
      }
      closeModal();
      await loadDecks();
      if (activeDeckId) await openDeck(activeDeckId);
    };
    el("m-name").focus();
  }

  function openCardModal(existing) {
    const isEdit = Boolean(existing);
    const t = cardType(existing) || "flash";
    openModal(`
      <h3>${isEdit ? "Edit card" : "New card"}</h3>
      <div class="field"><label>Type</label>
        <select id="m-type">
          <option value="flash" ${t === "flash" ? "selected" : ""}>Flashcard</option>
          <option value="qa" ${t === "qa" ? "selected" : ""}>Q &amp; A</option>
          <option value="quiz" ${t === "quiz" ? "selected" : ""}>Quiz (multiple choice)</option>
          <option value="truefalse" ${t === "truefalse" ? "selected" : ""}>True / False</option>
          <option value="cloze" ${t === "cloze" ? "selected" : ""}>Fill in the blank</option>
        </select>
      </div>
      <div class="field"><label>Prompt / front</label><textarea id="m-front" placeholder="Term, question, or statement">${escapeHtml(existing?.front || "")}</textarea></div>
      <div class="field"><label>Answer / back</label><textarea id="m-back" placeholder="Definition, answer, or True/False">${escapeHtml(existing?.back || "")}</textarea></div>
      <div class="field"><label>Choices (quiz only, one per line)</label><textarea id="m-choices" placeholder="Option A&#10;Option B&#10;Option C&#10;Option D">${escapeHtml((existing?.choices || []).join("\n"))}</textarea></div>
      <div class="field"><label>Correct choice index (quiz, 0-based)</label><input id="m-answer-index" type="number" min="0" value="${existing?.answerIndex >= 0 ? existing.answerIndex : 0}" /></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="m-cancel">Cancel</button>
        <button type="button" class="btn btn-primary" id="m-save">Save</button>
      </div>
    `);
    el("m-cancel").onclick = closeModal;
    el("m-save").onclick = async () => {
      const front = el("m-front").value.trim();
      const back = el("m-back").value.trim();
      const type = el("m-type").value;
      const choices = el("m-choices").value
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      if (!front || !activeDeckId) return;
      if (type !== "quiz" && type !== "truefalse" && !back) return;
      const card = {
        type,
        front,
        back: back || (type === "truefalse" ? "True" : choices[0] || "…"),
        choices,
        answerIndex: Number(el("m-answer-index").value) || 0,
        answer: type === "truefalse" ? !/^false|לא|incorrect/i.test(back) : undefined,
      };
      if (isEdit) {
        await invoke("card.update", { deckId: activeDeckId, cardId: existing.id, card: { ...existing, ...card } });
      } else {
        await invoke("card.add", { deckId: activeDeckId, ...card });
      }
      closeModal();
      await openDeck(activeDeckId);
      await loadDecks();
    };
    el("m-front").focus();
  }

  function openAiModal() {
    const deck = activeDeck();
    openModal(`
      <h3>✦ AI generate</h3>
      <p class="modal-lead">Pick a format — or let the model invent a mix of quizzes, true/false, Q&amp;A and flashcards.</p>
      <div class="field"><label>Topic</label><textarea id="m-topic" placeholder="e.g. macOS vs Windows, or photosynthesis quiz">${escapeHtml(deck?.name || "")}</textarea></div>
      <div class="field"><label>Format</label>
        <select id="m-mode">
          <option value="auto" selected>Auto — best mix / card game</option>
          <option value="mixed">Mixed types</option>
          <option value="quiz">Quiz only (multiple choice)</option>
          <option value="truefalse">True / False only</option>
          <option value="qa">Questions &amp; answers</option>
          <option value="flash">Classic flashcards</option>
          <option value="cloze">Fill in the blank</option>
        </select>
      </div>
      <div class="field"><label>How many cards?</label>
        <select id="m-count">
          <option value="8">8</option>
          <option value="12" selected>12</option>
          <option value="20">20</option>
        </select>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="m-cancel">Cancel</button>
        <button type="button" class="btn btn-primary" id="m-save">Generate</button>
      </div>
    `);
    el("m-cancel").onclick = closeModal;
    el("m-save").onclick = async () => {
      const topic = el("m-topic").value.trim();
      if (!topic || !activeDeckId) return;
      const btn = el("m-save");
      btn.disabled = true;
      btn.textContent = "Generating…";
      try {
        const res = await invoke("cards.generate", {
          topic,
          count: Number(el("m-count").value) || 12,
          language: activeDeck()?.language || "en",
          mode: el("m-mode").value,
        });
        if (!res?.ok) throw new Error(res?.error || "Generate failed");
        for (const card of res.cards || []) {
          await invoke("card.add", { deckId: activeDeckId, ...card });
        }
        if (res.title || res.summary) {
          const d = activeDeck();
          await invoke("deck.update", {
            id: activeDeckId,
            name: d?.name,
            description: res.summary || d?.description || "",
            language: d?.language,
          });
        }
        closeModal();
        await openDeck(activeDeckId);
        await loadDecks();
      } catch (err) {
        btn.disabled = false;
        btn.textContent = "Generate";
        alert(err?.message || String(err));
      }
    };
    el("m-topic").focus();
  }

  async function deleteDeck(id) {
    if (!confirm("Delete this deck and all its cards?")) return;
    await invoke("deck.delete", { id });
    if (activeDeckId === id) activeDeckId = null;
    await loadDecks();
    setPage("home");
  }

  async function deleteCard(cardId) {
    if (!activeDeckId) return;
    await invoke("card.delete", { deckId: activeDeckId, cardId });
    await openDeck(activeDeckId);
    await loadDecks();
  }

  function buildStudyQueue(deck) {
    const now = Date.now();
    const due = deck.cards.filter((c) => new Date(c.dueAt).getTime() <= now);
    const pool = due.length ? due : deck.cards.slice();
    return pool.sort(() => Math.random() - 0.5);
  }

  async function startStudy() {
    if (!activeDeckId) return;
    const res = await invoke("deck.get", { id: activeDeckId });
    if (!res?.ok || !res.deck.cards.length) {
      alert("Add some cards first");
      return;
    }
    studyQueue = buildStudyQueue(res.deck);
    studyIndex = 0;
    sessionReviewed = 0;
    flipped = false;
    answered = false;
    el("study-done").hidden = true;
    el("flashcard").hidden = false;
    el("study-feedback").hidden = true;
    setPage("study");
    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.page === "study");
    });
    showStudyCard();
  }

  function showStudyCard() {
    const card = studyQueue[studyIndex];
    const done = el("study-done");
    const grades = el("study-grades");
    const flash = el("flashcard");
    const choices = el("quiz-choices");
    const feedback = el("study-feedback");
    const badge = el("study-type-badge");

    if (!card) {
      flash.hidden = true;
      grades.hidden = true;
      choices.hidden = true;
      feedback.hidden = true;
      done.hidden = false;
      el("study-done-msg").textContent = `Reviewed ${sessionReviewed} card${sessionReviewed === 1 ? "" : "s"} this session.`;
      publishScreen();
      return;
    }

    done.hidden = true;
    flash.hidden = false;
    flipped = false;
    answered = false;
    grades.hidden = true;
    feedback.hidden = true;
    feedback.textContent = "";
    flash.classList.remove("is-back");

    const t = cardType(card);
    badge.textContent = TYPE_LABELS[t] || t;
    el("flashcard-text").textContent = card.front;
    el("study-step").textContent = `Card ${studyIndex + 1} / ${studyQueue.length}`;
    el("study-remaining").textContent = `${studyQueue.length - studyIndex} left`;

    if (isChoiceCard(card)) {
      el("flashcard-hint").textContent = t === "truefalse" ? "True or False?" : "Choose the best answer";
      flash.classList.add("is-prompt-only");
      const he = activeDeck()?.language === "he";
      const opts =
        t === "truefalse"
          ? [
              { label: he ? "נכון" : "True", index: 0 },
              { label: he ? "לא נכון" : "False", index: 1 },
            ]
          : (card.choices || []).map((label, index) => ({ label, index }));
      choices.hidden = false;
      choices.innerHTML = opts
        .map(
          (o) =>
            `<button type="button" class="choice-btn" data-choice="${o.index}">${escapeHtml(o.label)}</button>`
        )
        .join("");
      choices.querySelectorAll("[data-choice]").forEach((btn) => {
        btn.addEventListener("click", () => answerChoice(Number(btn.dataset.choice)));
      });
    } else {
      flash.classList.remove("is-prompt-only");
      choices.hidden = true;
      choices.innerHTML = "";
      el("flashcard-hint").textContent =
        t === "cloze" ? "Blank · click to reveal" : t === "qa" ? "Question · click to reveal" : "Front · click to flip";
    }
    publishScreen();
  }

  function flipCard() {
    const card = studyQueue[studyIndex];
    if (!card || isChoiceCard(card) || answered) return;
    flipped = !flipped;
    const flash = el("flashcard");
    flash.classList.toggle("is-back", flipped);
    el("flashcard-hint").textContent = flipped ? "Answer · rate below" : "Prompt · click to flip";
    el("flashcard-text").textContent = flipped ? card.back : card.front;
    el("study-grades").hidden = !flipped;
    publishScreen();
  }

  async function answerChoice(index) {
    const card = studyQueue[studyIndex];
    if (!card || !isChoiceCard(card) || answered) return;
    answered = true;
    const correct = Number(card.answerIndex) === Number(index);
    const choices = el("quiz-choices");
    choices.querySelectorAll(".choice-btn").forEach((btn) => {
      const i = Number(btn.dataset.choice);
      btn.disabled = true;
      if (i === Number(card.answerIndex)) btn.classList.add("is-correct");
      if (i === index && !correct) btn.classList.add("is-wrong");
    });
    const feedback = el("study-feedback");
    feedback.hidden = false;
    feedback.textContent = correct
      ? `Correct! ${card.explanation || ""}`.trim()
      : `Not quite. Answer: ${card.choices?.[card.answerIndex] ?? card.back}${card.explanation ? " — " + card.explanation : ""}`;
    feedback.classList.toggle("is-ok", correct);
    feedback.classList.toggle("is-bad", !correct);

    await new Promise((r) => setTimeout(r, correct ? 650 : 1100));
    await gradeCard(correct ? "good" : "again", { skipFlipCheck: true });
  }

  async function gradeCard(grade, opts = {}) {
    const card = studyQueue[studyIndex];
    if (!card || !activeDeckId) return;
    if (!opts.skipFlipCheck && !isChoiceCard(card) && !flipped) return;
    await invoke("card.grade", { deckId: activeDeckId, cardId: card.id, grade });
    sessionReviewed += 1;
    if (grade === "again") {
      studyQueue.push({ ...card });
    }
    studyIndex += 1;
    showStudyCard();
    await loadDecks();
  }

  function publishScreen() {
    const deck = activeDeck();
    const card = studyQueue[studyIndex];
    const page = document.querySelector(".page.active")?.dataset.page || "home";
    invoke("screen.publish", {
      app: "Study Deck",
      page,
      deckName: deck?.name || null,
      cardCount: deck?.cards?.length || decks.reduce((n, d) => n + (d.cardCount || 0), 0),
      studying: page === "study",
      cardType: page === "study" && card ? cardType(card) : null,
      cardFront: page === "study" && card ? card.front : null,
      cardBackVisible: page === "study" && (flipped || answered),
      cardBack: page === "study" && (flipped || answered) && card ? card.back : null,
    }).catch(() => {});
  }

  function bind() {
    el("btn-new-deck").addEventListener("click", () => openDeckModal());
    el("btn-empty-new").addEventListener("click", () => openDeckModal());
    el("btn-back-home").addEventListener("click", () => {
      activeDeckId = null;
      setPage("home");
      renderHome();
    });
    el("btn-add-card").addEventListener("click", () => openCardModal());
    el("btn-ai-gen").addEventListener("click", () => openAiModal());
    el("btn-start-study").addEventListener("click", () => startStudy());
    el("nav-study").addEventListener("click", () => {
      if (!el("nav-study").disabled) startStudy();
    });
    document.querySelector('.nav-item[data-page="home"]').addEventListener("click", () => {
      setPage("home");
      renderHome();
    });
    el("flashcard").addEventListener("click", () => flipCard());
    el("study-grades").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-grade]");
      if (btn) gradeCard(btn.dataset.grade);
    });
    el("btn-study-again").addEventListener("click", () => startStudy());
    el("btn-study-back").addEventListener("click", () => {
      if (activeDeckId) openDeck(activeDeckId);
      else setPage("home");
    });
    el("modal").addEventListener("click", (e) => {
      if (e.target.id === "modal") closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
      const studyPage = el("page-study");
      if (studyPage.hidden) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!flipped) flipCard();
      }
      if (flipped && ["1", "2", "3", "4"].includes(e.key)) {
        const map = { 1: "again", 2: "hard", 3: "good", 4: "easy" };
        gradeCard(map[e.key]);
      }
    });
  }

  window.StudyDeckApp = {
    setPage(page) {
      if (page === "study") startStudy();
      else if (page === "deck" && activeDeckId) openDeck(activeDeckId);
      else setPage("home");
    },
    openDeck: (id) => openDeck(id),
  };

  async function init() {
    bind();
    try {
      await loadDecks();
      setPage("home");
    } catch (err) {
      el("deck-grid").innerHTML = `<p class="empty-state">${escapeHtml(err?.message || String(err))}</p>`;
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();