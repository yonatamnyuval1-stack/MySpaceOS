window.StocksPages = window.StocksPages || {};

window.StocksPages.aiAnalysis = (function () {
  const { escapeHtml, invoke, formatMoney, formatPct, formatCap } = window.Stocks;

  const page = document.getElementById("page-ai-analysis");
  const LANG_KEY = "myspace-stocks-ai-analysis-lang";
  let symbol = "";
  let quote = null;
  let analysis = null;
  let busy = false;
  let searchTimer = null;
  let analysisLang = loadAnalysisLang();

  function loadAnalysisLang() {
    try {
      const v = localStorage.getItem(LANG_KEY);
      if (v === "he" || v === "en") return v;
    } catch {
    }
    return window.StocksI18n?.lang?.() === "he" ? "he" : "en";
  }

  function saveAnalysisLang(lang) {
    analysisLang = lang === "he" ? "he" : "en";
    try {
      localStorage.setItem(LANG_KEY, analysisLang);
    } catch {
    }
  }

  function getAnalysisLang() {
    return analysisLang === "he" ? "he" : "en";
  }

  function syncLangButtons() {
    page.querySelectorAll("[data-ai-lang]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-ai-lang") === getAnalysisLang());
    });
  }

  const CATEGORIES = [
    { id: "snapshot", titleKey: "ai.cat.snapshot" },
    { id: "business", titleKey: "ai.cat.business" },
    { id: "pipeline", titleKey: "ai.cat.pipeline" },
    { id: "capitalAllocation", titleKey: "ai.cat.capital" },
    { id: "financials", titleKey: "ai.cat.financials" },
    { id: "valuation", titleKey: "ai.cat.valuation" },
    { id: "growth", titleKey: "ai.cat.growth" },
    { id: "competition", titleKey: "ai.cat.competition" },
    { id: "risks", titleKey: "ai.cat.risks" },
    { id: "thesisKillers", titleKey: "ai.cat.killers" },
    { id: "scenarios", titleKey: "ai.cat.scenarios" },
    { id: "technical", titleKey: "ai.cat.technical" },
    { id: "fit", titleKey: "ai.cat.fit" },
    { id: "watchlist", titleKey: "ai.cat.watchlist" },
    { id: "verifyNext", titleKey: "ai.cat.verify" },
    { id: "bottomLine", titleKey: "ai.cat.bottomLine" },
  ];

  function t(key, fallback) {
    return window.StocksI18n?.t?.(key) || fallback || key;
  }

  function setError(msg) {
    const el = page.querySelector("#ai-error");
    if (!el) return;
    if (!msg) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    el.textContent = msg;
  }

  function setBusy(on) {
    busy = on;
    page.classList.toggle("is-analyzing", on);
    const btn = page.querySelector("#btn-ai-fill");
    const refresh = page.querySelector("#btn-ai-refresh");
    if (btn) {
      btn.disabled = on || !symbol;
      btn.textContent = on ? t("ai.analyzing", "Analyzing…") : t("ai.fillAll", "Fill all with AI");
    }
    if (refresh) refresh.disabled = on || !symbol;
  }

  function renderPickerQuote() {
    const el = page.querySelector("#ai-selected");
    if (!el) return;
    if (!symbol) {
      el.innerHTML = `<span class="muted">${escapeHtml(t("ai.pickHint", "Search and select a symbol to analyze."))}</span>`;
      return;
    }
    const name = quote?.name || symbol;
    const price = quote ? formatMoney(quote.price, quote.currency) : "—";
    const chg = quote ? formatPct(quote.changePct) : "";
    const cls = quote?.changePct > 0 ? "up" : quote?.changePct < 0 ? "down" : "";
    el.innerHTML = `
      <div class="ai-selected-main">
        <strong>${escapeHtml(symbol)}</strong>
        <span>${escapeHtml(name)}</span>
      </div>
      <div class="ai-selected-price ${cls}">
        <span>${escapeHtml(price)}</span>
        <span>${escapeHtml(chg)}</span>
      </div>`;
  }

  function emptyCard(id, title) {
    return `
      <article class="ai-card" data-cat="${id}">
        <header class="ai-card-head">
          <h3>${escapeHtml(title)}</h3>
          <span class="ai-card-state muted">${escapeHtml(t("ai.empty", "Waiting for AI…"))}</span>
        </header>
        <div class="ai-card-body ai-card-body--empty">
          <p class="muted">${escapeHtml(t("ai.emptyBody", "Press “Fill all with AI” to generate this section."))}</p>
        </div>
      </article>`;
  }

  function listHtml(items) {
    if (!items?.length) return "";
    return `<ul class="ai-list">${items.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>`;
  }

  function renderCategoryBody(id, a) {
    if (!a) return `<p class="muted">${escapeHtml(t("ai.emptyBody", "Waiting…"))}</p>`;

    if (id === "snapshot") {
      const hz =
        a.snapshot.horizonMonths != null
          ? `<p class="muted">${escapeHtml(t("ai.horizonMonths", "Horizon"))}: ${escapeHtml(String(a.snapshot.horizonMonths))}m</p>`
          : "";
      return `
        <div class="ai-score-row">
          <div class="ai-score">${escapeHtml(String(a.snapshot.score))}<span>/10</span></div>
          <div>
            ${a.snapshot.oneLiner ? `<p class="ai-oneliner">${escapeHtml(a.snapshot.oneLiner)}</p>` : ""}
            <p>${escapeHtml(a.snapshot.summary || "—")}</p>
            <p class="muted">${escapeHtml(a.snapshot.scoreWhy || "")}</p>
            ${hz}
          </div>
        </div>
        ${(a.snapshot.bullCase || a.snapshot.bearCase)
          ? `<div class="ai-case-grid">
              ${a.snapshot.bullCase ? `<div class="ai-case ai-case--bull"><span>${escapeHtml(t("ai.bullCase", "Bull"))}</span><p>${escapeHtml(a.snapshot.bullCase)}</p></div>` : ""}
              ${a.snapshot.bearCase ? `<div class="ai-case ai-case--bear"><span>${escapeHtml(t("ai.bearCase", "Bear"))}</span><p>${escapeHtml(a.snapshot.bearCase)}</p></div>` : ""}
            </div>`
          : ""}`;
    }
    if (id === "business") {
      return `
        <p><strong>${escapeHtml(t("ai.model", "Model"))}:</strong> ${escapeHtml(a.business.model || "—")}</p>
        <p><strong>${escapeHtml(t("ai.moat", "Moat"))}:</strong> ${escapeHtml(a.business.moat || "—")}</p>
        ${a.business.pricingPower ? `<p><strong>${escapeHtml(t("ai.pricing", "Pricing power"))}:</strong> ${escapeHtml(a.business.pricingPower)}</p>` : ""}
        ${a.business.customers ? `<p><strong>${escapeHtml(t("ai.customers", "Customers"))}:</strong> ${escapeHtml(a.business.customers)}</p>` : ""}
        ${a.business.economics ? `<p><strong>${escapeHtml(t("ai.economics", "Economics"))}:</strong> ${escapeHtml(a.business.economics)}</p>` : ""}
        ${a.business.segments?.length ? `<p class="muted">${escapeHtml(t("ai.segments", "Segments"))}</p>${listHtml(a.business.segments)}` : ""}`;
    }
    if (id === "pipeline") {
      if (!a.pipeline.items?.length) return `<p class="muted">—</p>`;
      return `<div class="ai-pipeline">${a.pipeline.items
        .map(
          (it) => `
        <div class="ai-pipeline-item">
          <div class="ai-pipeline-top">
            <strong>${escapeHtml(it.title)}</strong>
            <span class="ai-pill-row">
              ${it.horizon ? `<span class="ai-pill">${escapeHtml(it.horizon)}</span>` : ""}
              ${it.impact ? `<span class="ai-pill">${escapeHtml(t("ai.impact", "impact"))}: ${escapeHtml(it.impact)}</span>` : ""}
              ${it.confidence ? `<span class="ai-pill">${escapeHtml(t("ai.confidence", "conf."))}: ${escapeHtml(it.confidence)}</span>` : ""}
            </span>
          </div>
          <p>${escapeHtml(it.detail || "")}</p>
        </div>`
        )
        .join("")}</div>`;
    }
    if (id === "capitalAllocation") {
      const c = a.capitalAllocation || {};
      return `
        <p>${escapeHtml(c.summary || "—")}</p>
        ${c.balanceSheet ? `<p><strong>${escapeHtml(t("ai.balanceSheet", "Balance sheet"))}:</strong> ${escapeHtml(c.balanceSheet)}</p>` : ""}
        ${c.shareholderReturns ? `<p><strong>${escapeHtml(t("ai.returns", "Shareholder returns"))}:</strong> ${escapeHtml(c.shareholderReturns)}</p>` : ""}
        ${c.priorities?.length ? `<p class="muted">${escapeHtml(t("ai.priorities", "Priorities"))}</p>${listHtml(c.priorities)}` : ""}`;
    }
    if (id === "financials") {
      const q = a.quoteSnapshot;
      const g = a.grounding || {};
      const facts = q
        ? `<div class="ai-facts">
            <span>${escapeHtml(t("ai.price", "Price"))}: <strong>${escapeHtml(formatMoney(q.price, q.currency))}</strong></span>
            <span>P/E: <strong>${q.trailingPE != null ? escapeHtml(Number(q.trailingPE).toFixed(2)) : "—"}</strong></span>
            <span>Fwd P/E: <strong>${q.forwardPE != null ? escapeHtml(Number(q.forwardPE).toFixed(2)) : "—"}</strong></span>
            <span>${escapeHtml(t("ai.mktcap", "Mkt cap"))}: <strong>${escapeHtml(formatCap(q.marketCap))}</strong></span>
            <span>${escapeHtml(t("ai.revGrowth", "Rev growth"))}: <strong>${q.revenueGrowthPct != null ? escapeHtml(String(q.revenueGrowthPct)) + "%" : "—"}</strong></span>
            <span>${escapeHtml(t("ai.epsGrowth", "EPS growth"))}: <strong>${q.earningsGrowthPct != null ? escapeHtml(String(q.earningsGrowthPct)) + "%" : "—"}</strong></span>
            <span>${escapeHtml(t("ai.margin", "Margin"))}: <strong>${q.profitMarginPct != null ? escapeHtml(String(q.profitMarginPct)) + "%" : "—"}</strong></span>
            <span>D/E: <strong>${q.debtToEquity != null ? escapeHtml(Number(q.debtToEquity).toFixed(1)) : "—"}</strong></span>
            <span>${escapeHtml(t("ai.target", "Target"))}: <strong>${q.targetMeanPrice != null ? escapeHtml(formatMoney(q.targetMeanPrice, q.currency)) : "—"}</strong></span>
            <span>Beta: <strong>${q.beta != null ? escapeHtml(String(q.beta)) : "—"}</strong></span>
            ${q.pctOf52WeekRange != null ? `<span>52W: <strong>${escapeHtml(String(q.pctOf52WeekRange))}%</strong></span>` : ""}
            ${g.sector ? `<span>${escapeHtml(t("ai.sector", "Sector"))}: <strong>${escapeHtml(g.sector)}</strong></span>` : ""}
            ${g.nextEarningsDates?.length ? `<span>${escapeHtml(t("ai.earnings", "Earnings"))}: <strong>${escapeHtml(g.nextEarningsDates.join(", "))}</strong></span>` : ""}
          </div>`
        : "";
      return `${facts}<p>${escapeHtml(a.financials.summary || "—")}</p>
        ${a.financials.quality ? `<p class="muted">${escapeHtml(a.financials.quality)}</p>` : ""}
        ${listHtml(a.financials.highlights)}
        ${a.financials.redFlags?.length ? `<p class="muted">${escapeHtml(t("ai.finRedFlags", "Red flags"))}</p>${listHtml(a.financials.redFlags)}` : ""}`;
    }
    if (id === "valuation") {
      return `
        <p><span class="ai-pill ai-pill--${escapeHtml(a.valuation.stance)}">${escapeHtml(a.valuation.stance)}</span></p>
        <p>${escapeHtml(a.valuation.summary || "—")}</p>
        ${a.valuation.method ? `<p><strong>${escapeHtml(t("ai.method", "Lens"))}:</strong> ${escapeHtml(a.valuation.method)}</p>` : ""}
        <p class="muted">${escapeHtml(a.valuation.vsPeers || "")}</p>
        ${a.valuation.impliedExpectations ? `<p><strong>${escapeHtml(t("ai.implied", "Implied"))}:</strong> ${escapeHtml(a.valuation.impliedExpectations)}</p>` : ""}
        ${a.valuation.fairValueNote ? `<p class="muted">${escapeHtml(a.valuation.fairValueNote)}</p>` : ""}`;
    }
    if (id === "growth") {
      return `
        <p>${escapeHtml(a.growth.summary || "—")}</p>
        ${a.growth.durability ? `<p><strong>${escapeHtml(t("ai.durability", "Durability"))}:</strong> ${escapeHtml(a.growth.durability)}</p>` : ""}
        ${a.growth.reinvestment ? `<p><strong>${escapeHtml(t("ai.reinvest", "Reinvestment"))}:</strong> ${escapeHtml(a.growth.reinvestment)}</p>` : ""}
        ${a.growth.drivers?.length ? `<p class="muted">${escapeHtml(t("ai.drivers", "Drivers"))}</p>${listHtml(a.growth.drivers)}` : ""}
        ${a.growth.headwinds?.length ? `<p class="muted">${escapeHtml(t("ai.headwinds", "Headwinds"))}</p>${listHtml(a.growth.headwinds)}` : ""}`;
    }
    if (id === "competition") {
      return `
        <p>${escapeHtml(a.competition.summary || "—")}</p>
        <p class="muted">${escapeHtml(a.competition.position || "")}</p>
        ${a.competition.peers?.length ? `<p class="muted">${escapeHtml(t("ai.peers", "Peers"))}</p>${listHtml(a.competition.peers)}` : ""}
        ${a.competition.advantages?.length ? `<p class="muted">${escapeHtml(t("ai.advantages", "Advantages"))}</p>${listHtml(a.competition.advantages)}` : ""}
        ${a.competition.threats?.length ? `<p class="muted">${escapeHtml(t("ai.threats", "Threats"))}</p>${listHtml(a.competition.threats)}` : ""}`;
    }
    if (id === "risks") {
      if (!a.risks?.length) return `<p class="muted">—</p>`;
      return `<div class="ai-risks">${a.risks
        .map(
          (r) => `
        <div class="ai-risk ai-risk--${escapeHtml(r.severity)}">
          <div class="ai-risk-top">
            <span class="ai-pill">${escapeHtml(r.severity)}</span>
            <strong>${escapeHtml(r.title)}</strong>
          </div>
          <p>${escapeHtml(r.detail || "")}</p>
          ${r.mitigant ? `<p class="muted">${escapeHtml(t("ai.mitigant", "Mitigant"))}: ${escapeHtml(r.mitigant)}</p>` : ""}
        </div>`
        )
        .join("")}</div>`;
    }
    if (id === "thesisKillers") {
      const k = a.thesisKillers || {};
      return `
        <p>${escapeHtml(k.summary || "—")}</p>
        ${k.items?.length ? listHtml(k.items) : ""}`;
    }
    if (id === "scenarios") {
      const rows = ["bull", "base", "bear"].map((key) => {
        const s = a.scenarios[key] || {};
        const up =
          s.upsidePct != null && Number.isFinite(Number(s.upsidePct))
            ? `<span class="ai-upside">${Number(s.upsidePct) >= 0 ? "+" : ""}${escapeHtml(String(Number(s.upsidePct)))}%</span>`
            : "";
        return `
          <div class="ai-scenario ai-scenario--${key}">
            <div class="ai-scenario-head">
              <strong>${escapeHtml(t("ai.scenario." + key, key))}</strong>
              <span class="ai-scenario-meta">
                ${up}
                <span class="ai-pct">${escapeHtml(String(s.pct ?? 0))}%</span>
              </span>
            </div>
            <div class="ai-scenario-bar"><i style="width:${Math.max(0, Math.min(100, s.pct || 0))}%"></i></div>
            <p>${escapeHtml(s.thesis || "")}</p>
            ${s.whatMustHappen?.length ? `<p class="muted">${escapeHtml(t("ai.mustHappen", "Must happen"))}</p>${listHtml(s.whatMustHappen)}` : ""}
            ${s.triggers?.length ? `<p class="muted">${escapeHtml(t("ai.triggers", "Triggers"))}</p>${listHtml(s.triggers)}` : ""}
          </div>`;
      });
      return `<div class="ai-scenarios">${rows.join("")}</div>
        <p class="ai-disclaimer muted">${escapeHtml(t("ai.probNote", "Probabilities are AI estimates, not guarantees."))}</p>`;
    }
    if (id === "technical") {
      const tf = a.technicalFacts || {};
      const y = tf.oneYear || {};
      const factsBlock = `
        <div class="ai-facts">
          <span>RSI 3M: <strong>${tf.rsi14 ?? "—"}</strong></span>
          <span>3M: <strong>${tf.periodReturnPct != null ? tf.periodReturnPct + "%" : "—"}</strong></span>
          <span>1Y: <strong>${y.periodReturnPct != null ? y.periodReturnPct + "%" : "—"}</strong></span>
          <span>Vol: <strong>${tf.volatilityPct != null ? tf.volatilityPct + "%" : "—"}</strong></span>
          <span>MA20: <strong>${escapeHtml(tf.trendVsMa20 || "—")}</strong></span>
          <span>MA50: <strong>${escapeHtml(tf.trendVsMa50 || "—")}</strong></span>
        </div>`;
      return `${factsBlock}<p><span class="ai-pill">${escapeHtml(a.technical?.bias || "neutral")}</span></p>
        <p>${escapeHtml(a.technical?.summary || "—")}</p>
        ${a.technical?.levels ? `<p><strong>${escapeHtml(t("ai.levels", "Levels"))}:</strong> ${escapeHtml(a.technical.levels)}</p>` : ""}
        ${a.technical?.invalidation ? `<p class="muted">${escapeHtml(t("ai.invalidation", "Invalidation"))}: ${escapeHtml(a.technical.invalidation)}</p>` : ""}`;
    }
    if (id === "fit") {
      return `
        <p><strong>${escapeHtml(t("ai.horizon", "Horizon"))}:</strong> ${escapeHtml(a.fit.horizon || "—")}</p>
        ${a.fit.positionSizing ? `<p><strong>${escapeHtml(t("ai.sizing", "Sizing"))}:</strong> ${escapeHtml(a.fit.positionSizing)}</p>` : ""}
        ${a.fit.suitableFor?.length ? `<p class="muted">${escapeHtml(t("ai.suitable", "Suitable for"))}</p>${listHtml(a.fit.suitableFor)}` : ""}
        ${a.fit.notFor?.length ? `<p class="muted">${escapeHtml(t("ai.notFor", "Not ideal for"))}</p>${listHtml(a.fit.notFor)}` : ""}`;
    }
    if (id === "watchlist") {
      if (!a.watchlist?.length) return `<p class="muted">—</p>`;
      return `<div class="ai-watch">${a.watchlist
        .map(
          (w) => `
        <div class="ai-watch-item">
          <strong>${escapeHtml(w.item)}</strong>
          <p>${escapeHtml(w.why || "")}</p>
          ${w.threshold ? `<p class="muted">${escapeHtml(t("ai.threshold", "Trigger"))}: ${escapeHtml(w.threshold)}</p>` : ""}
        </div>`
        )
        .join("")}</div>`;
    }
    if (id === "verifyNext") {
      const v = a.verifyNext || {};
      return `
        <p>${escapeHtml(v.summary || "—")}</p>
        ${v.questions?.length ? listHtml(v.questions) : ""}`;
    }
    if (id === "bottomLine") {
      const actionLabel = t("ai.action." + (a.bottomLine.action || "deeper_research"), a.bottomLine.action || "");
      const conv = a.bottomLine.conviction
        ? `<span class="ai-pill">${escapeHtml(t("ai.conviction", "Conviction"))}: ${escapeHtml(a.bottomLine.conviction)}</span>`
        : "";
      return `
        ${listHtml(a.bottomLine.bullets)}
        ${a.bottomLine.asymmetry ? `<p><strong>${escapeHtml(t("ai.asymmetry", "Asymmetry"))}:</strong> ${escapeHtml(a.bottomLine.asymmetry)}</p>` : ""}
        <p class="ai-pill-row">${conv}<span class="ai-pill ai-pill--action">${escapeHtml(actionLabel)}</span></p>`;
    }
    return "";
  }

  function renderCards() {
    const grid = page.querySelector("#ai-cards");
    if (!grid) return;
    grid.innerHTML = CATEGORIES.map((c) => {
      const title = t(c.titleKey, c.id);
      if (!analysis) return emptyCard(c.id, title);
      const body = renderCategoryBody(c.id, analysis);
      return `
        <article class="ai-card is-filled" data-cat="${c.id}">
          <header class="ai-card-head">
            <h3>${escapeHtml(title)}</h3>
            <span class="ai-card-state">${escapeHtml(t("ai.filled", "Filled"))}</span>
          </header>
          <div class="ai-card-body">${body}</div>
        </article>`;
    }).join("");
  }

  function renderMeta() {
    const el = page.querySelector("#ai-meta");
    if (!el) return;
    if (!analysis?.generatedAt) {
      el.textContent = "";
      el.innerHTML = "";
      return;
    }
    const when = new Date(analysis.generatedAt);
    const whenText = Number.isNaN(when.getTime()) ? analysis.generatedAt : when.toLocaleString();
    const g = analysis.grounding || {};
    const bits = [];
    if (g.fundamentals) bits.push(t("ai.ground.fundamentals", "Fundamentals"));
    if (g.peers) bits.push(`${t("ai.ground.peers", "Peers")} (${g.peerCount || 0})`);
    if (g.news) bits.push(`${t("ai.ground.news", "News")} (${g.newsCount || 0})`);
    const ground =
      bits.length > 0
        ? `<span class="ai-grounding">${escapeHtml(t("ai.groundedOn", "Grounded on"))}: ${bits
            .map((b) => `<span class="ai-ground-chip">${escapeHtml(b)}</span>`)
            .join("")}</span>`
        : `<span class="ai-grounding muted">${escapeHtml(
            t("ai.ground.partial", "Limited live fundamentals — analysis may rely more on model knowledge")
          )}</span>`;
    el.innerHTML = `${escapeHtml(t("ai.generatedAt", "Generated"))}: ${escapeHtml(whenText)} · ${ground}`;
  }

  async function loadQuote(sym) {
    const res = await invoke("quote.get", { symbols: [sym] });
    quote = res.quotes?.[0] || null;
    renderPickerQuote();
  }

  async function selectSymbol(sym) {
    symbol = String(sym || "").toUpperCase().trim();
    analysis = null;
    setError("");
    page.querySelector("#ai-search-results").hidden = true;
    page.querySelector("#ai-symbol-input").value = symbol;
    setBusy(false);
    const fill = page.querySelector("#btn-ai-fill");
    if (fill) fill.disabled = !symbol;
    const refresh = page.querySelector("#btn-ai-refresh");
    if (refresh) refresh.disabled = !symbol;
    renderCards();
    renderMeta();
    renderPickerQuote();
    if (!symbol) {
      quote = null;
      return;
    }
    try {
      await loadQuote(symbol);
      try {
        const cached = await invoke("analysis.getCached", { symbol, lang: getAnalysisLang() });
        if (cached?.analysis) {
          analysis = cached.analysis;
          renderCards();
          renderMeta();
        }
      } catch (cacheErr) {
        const msg = String(cacheErr?.message || cacheErr || "");
        // Old main process without analysis channels — don't block symbol pick
        if (/unknown channel/i.test(msg)) {
          setError(
            window.StocksI18n?.lang?.() === "he"
              ? "צריך לסגור לגמרי את My Space ולפתוח מחדש כדי להפעיל ניתוח AI."
              : "Fully quit and reopen My Space to enable AI Analysis."
          );
        }
        // otherwise ignore missing cache
      }
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  async function runAnalysis(force) {
    if (!symbol || busy) return;
    setError("");
    setBusy(true);
    try {
      const lang = getAnalysisLang();
      const res = await invoke("analysis.generate", { symbol, force: !!force, lang });
      if (!res?.ok) throw new Error(res?.error || "Analysis failed");
      analysis = res.analysis;
      renderCards();
      renderMeta();
      if (res.cached) {
        // still show as filled
      }
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onSearchInput() {
    const input = page.querySelector("#ai-symbol-input");
    const box = page.querySelector("#ai-search-results");
    const q = String(input?.value || "").trim();
    if (q.length < 1) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      try {
        const res = await invoke("search", {
          query: q,
          mode: window.StocksApp?.getActiveMode?.() || "stocks",
          relaxed: true,
          limit: 10,
        });
        const results = res.results || [];
        if (!results.length) {
          const guess = q.toUpperCase().replace(/[^A-Z0-9.^=-]/g, "");
          if (guess.length >= 1 && guess.length <= 16) {
            box.innerHTML = `
              <button type="button" class="top-search-item" data-symbol="${escapeHtml(guess)}">
                <strong>${escapeHtml(guess)}</strong>
                <span>${escapeHtml(t("ai.useSymbol", "Use this symbol"))}</span>
              </button>
              <div class="top-search-empty">${escapeHtml(t("ai.noResults", "No matches in catalog"))}</div>`;
          } else {
            box.innerHTML = `<div class="top-search-empty">${escapeHtml(t("ai.noResults", "No results"))}</div>`;
          }
          box.hidden = false;
          box.querySelectorAll("[data-symbol]").forEach((btn) => {
            btn.addEventListener("click", () => selectSymbol(btn.dataset.symbol));
          });
          return;
        }
        box.innerHTML = results
          .slice(0, 10)
          .map(
            (r) => `
          <button type="button" class="top-search-item" data-symbol="${escapeHtml(r.symbol)}">
            <strong>${escapeHtml(r.symbol)}</strong>
            <span>${escapeHtml(r.name || r.exchange || "")}</span>
          </button>`
          )
          .join("");
        box.hidden = false;
        box.querySelectorAll("[data-symbol]").forEach((btn) => {
          btn.addEventListener("click", () => selectSymbol(btn.dataset.symbol));
        });
      } catch (err) {
        box.innerHTML = `<div class="top-search-empty">${escapeHtml(err.message || "Search failed")}</div>`;
        box.hidden = false;
      }
    }, 220);
  }

  function bind() {
    page.querySelector("#ai-symbol-input")?.addEventListener("input", onSearchInput);
    page.querySelector("#ai-symbol-input")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const v = page.querySelector("#ai-symbol-input").value.trim();
        if (v) selectSymbol(v);
      }
    });
    page.querySelectorAll("[data-ai-lang]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const next = btn.getAttribute("data-ai-lang") === "he" ? "he" : "en";
        if (next === getAnalysisLang()) return;
        saveAnalysisLang(next);
        syncLangButtons();
        analysis = null;
        renderCards();
        renderMeta();
        if (!symbol) return;
        try {
          const cached = await invoke("analysis.getCached", { symbol, lang: getAnalysisLang() });
          if (cached?.analysis) {
            analysis = cached.analysis;
            renderCards();
            renderMeta();
          }
        } catch {
          /* ignore */
        }
      });
    });
    page.querySelector("#btn-ai-fill")?.addEventListener("click", () => runAnalysis(true));
    page.querySelector("#btn-ai-refresh")?.addEventListener("click", () => runAnalysis(true));
    page.querySelector("#btn-ai-open-detail")?.addEventListener("click", () => {
      if (symbol) window.StocksApp?.openStock?.(symbol);
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest("#ai-search-wrap")) {
        const box = page.querySelector("#ai-search-results");
        if (box) box.hidden = true;
      }
    });
    syncLangButtons();
  }

  function activate(sym) {
    syncLangButtons();
    if (sym) selectSymbol(sym);
    else {
      renderPickerQuote();
      renderCards();
      renderMeta();
      const fill = page.querySelector("#btn-ai-fill");
      if (fill) fill.disabled = !symbol;
    }
  }

  return {
    id: "ai-analysis",
    page,
    bind,
    activate,
    openForSymbol: selectSymbol,
    getSymbol: () => symbol,
    getAnalysisLang,
  };
})();
