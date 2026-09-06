window.TranslatePages = window.TranslatePages || {};

window.TranslatePages.main = (function () {
  const { escapeHtml, invoke, langLabel, countWords, speak, buildLangOptions } = window.Translate;
  const page = document.getElementById("page-translate");
  let debounce = null;
  let lastResult = null;
  let settings = {};

  function els() {
    return {
      source: page.querySelector("#source-text"),
      result: page.querySelector("#result-text"),
      from: page.querySelector("#lang-from"),
      to: page.querySelector("#lang-to"),
      swap: page.querySelector("#btn-swap"),
      translate: page.querySelector("#btn-translate"),
      clear: page.querySelector("#btn-clear"),
      paste: page.querySelector("#btn-paste"),
      copySrc: page.querySelector("#btn-copy-src"),
      copyRes: page.querySelector("#btn-copy-res"),
      speakSrc: page.querySelector("#btn-speak-src"),
      speakRes: page.querySelector("#btn-speak-res"),
      star: page.querySelector("#btn-star"),
      meta: page.querySelector("#translate-meta"),
      alts: page.querySelector("#alternatives"),
      defs: page.querySelector("#definitions"),
      roman: page.querySelector("#romanization"),
      recent: page.querySelector("#recent-pairs"),
      srcCount: page.querySelector("#src-count"),
      status: page.querySelector("#translate-status"),
    };
  }

  async function loadSettings() {
    const loaded = await invoke("storage.load");
    settings = loaded.data?.settings || {};
    const e = els();
    e.from.innerHTML = buildLangOptions(true);
    e.to.innerHTML = buildLangOptions(false);
    e.from.value = settings.fromLang || "auto";
    e.to.value = settings.toLang || "he";
    renderRecentPairs(loaded.data?.recentPairs || []);
  }

  function renderRecentPairs(pairs) {
    const el = els().recent;
    if (!el || !pairs.length) {
      if (el) el.innerHTML = "";
      return;
    }
    el.innerHTML = pairs
      .map((p) => {
        const [from, to] = p.split("|");
        return `<button type="button" class="pair-chip" data-from="${escapeHtml(from)}" data-to="${escapeHtml(to)}">${escapeHtml(langLabel(from))} → ${escapeHtml(langLabel(to))}</button>`;
      })
      .join("");
    el.querySelectorAll(".pair-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        els().from.value = btn.dataset.from;
        els().to.value = btn.dataset.to;
        saveLangPrefs();
        if (els().source.value.trim()) doTranslate();
      });
    });
  }

  async function saveLangPrefs() {
    const e = els();
    const loaded = await invoke("storage.load");
    loaded.data.settings.fromLang = e.from.value;
    loaded.data.settings.toLang = e.to.value;
    await invoke("storage.save", { data: loaded.data });
    settings = loaded.data.settings;
  }

  function updateCounts() {
    const text = els().source.value;
    els().srcCount.textContent = `${text.length} chars · ${countWords(text)} words`;
  }

  async function doTranslate() {
    const e = els();
    const text = e.source.value.trim();
    if (!text) {
      e.result.value = "";
      e.meta.textContent = "";
      e.alts.innerHTML = "";
      e.defs.innerHTML = "";
      e.roman.hidden = true;
      return;
    }

    e.status.textContent = "Translating…";
    e.translate.disabled = true;
    try {
      const res = await invoke("translate.text", { text, from: e.from.value, to: e.to.value });
      lastResult = res;
      e.result.value = res.translation;

      if (res.from && e.from.value === "auto") {
        e.meta.textContent = `Detected: ${res.fromName || res.from} · via ${res.provider}`;
      } else {
        e.meta.textContent = `${res.fromName || res.from} → ${res.toName || res.to} · ${res.provider}`;
      }

      if (res.alternatives?.length) {
        e.alts.innerHTML = `<span class="alts-label">Alternatives:</span> ${res.alternatives
          .map(
            (a) =>
              `<button type="button" class="alt-chip" data-alt="${escapeHtml(a)}">${escapeHtml(a)}</button>`
          )
          .join("")}`;
        e.alts.querySelectorAll(".alt-chip").forEach((btn) => {
          btn.addEventListener("click", () => {
            e.result.value = btn.dataset.alt;
          });
        });
      } else {
        e.alts.innerHTML = "";
      }

      if (res.definitions?.length) {
        e.defs.innerHTML = res.definitions
          .map(
            (d) =>
              `<div class="def-row"><span class="def-pos">${escapeHtml(d.pos)}</span> ${escapeHtml(d.meanings.join(", "))}</div>`
          )
          .join("");
      } else {
        e.defs.innerHTML = "";
      }

      if (res.romanization) {
        e.roman.hidden = false;
        e.roman.textContent = `Romanization: ${res.romanization}`;
      } else {
        e.roman.hidden = true;
      }

      e.status.textContent = "";
      e.star.textContent = "☆";

      if (settings.saveHistory !== false) {
        await invoke("history.add", {
          source: text,
          translation: res.translation,
          from: res.from || e.from.value,
          to: res.to,
          provider: res.provider,
        });
        const loaded = await invoke("storage.load");
        renderRecentPairs(loaded.data?.recentPairs || []);
      }
    } catch (err) {
      e.status.textContent = err.message;
      e.result.value = "";
    } finally {
      e.translate.disabled = false;
    }
  }

  function scheduleAuto() {
    clearTimeout(debounce);
    if (!settings.autoTranslate) return;
    debounce = setTimeout(doTranslate, 700);
  }

  function bind() {
    const e = els();
    e.translate.addEventListener("click", doTranslate);
    e.clear.addEventListener("click", () => {
      e.source.value = "";
      e.result.value = "";
      updateCounts();
      e.meta.textContent = "";
      e.alts.innerHTML = "";
      e.defs.innerHTML = "";
      e.roman.hidden = true;
      lastResult = null;
    });
    e.swap.addEventListener("click", () => {
      const from = e.from.value;
      const to = e.to.value;
      if (from === "auto") return;
      e.from.value = to;
      e.to.value = from;
      const tmp = e.source.value;
      e.source.value = e.result.value;
      e.result.value = tmp;
      saveLangPrefs();
      if (e.source.value.trim()) doTranslate();
    });
    e.from.addEventListener("change", saveLangPrefs);
    e.to.addEventListener("change", saveLangPrefs);
    e.source.addEventListener("input", () => {
      updateCounts();
      scheduleAuto();
    });
    e.source.addEventListener("keydown", (ev) => {
      if (ev.ctrlKey && ev.key === "Enter") {
        ev.preventDefault();
        doTranslate();
      }
    });
    e.paste.addEventListener("click", async () => {
      const clip = await invoke("clipboard.read");
      e.source.value = clip.text || "";
      updateCounts();
      doTranslate();
    });
    e.copySrc.addEventListener("click", async () => {
      await invoke("clipboard.write", { text: e.source.value });
      e.status.textContent = "Copied source";
      setTimeout(() => (e.status.textContent = ""), 1500);
    });
    e.copyRes.addEventListener("click", async () => {
      await invoke("clipboard.write", { text: e.result.value });
      e.status.textContent = "Copied translation";
      setTimeout(() => (e.status.textContent = ""), 1500);
    });
    e.speakSrc.addEventListener("click", async () => {
      e.status.textContent = "Loading speech…";
      const ok = await speak(e.source.value, e.from.value === "auto" ? lastResult?.from : e.from.value);
      e.status.textContent = ok ? "" : "Speech unavailable";
      if (!ok) setTimeout(() => (e.status.textContent = ""), 2000);
    });
    e.speakRes.addEventListener("click", async () => {
      e.status.textContent = "Loading speech…";
      const ok = await speak(e.result.value, e.to.value);
      e.status.textContent = ok ? "" : "Speech unavailable";
      if (!ok) setTimeout(() => (e.status.textContent = ""), 2000);
    });
    e.star.addEventListener("click", async () => {
      if (!lastResult) return;
      const res = await invoke("history.add", {
        source: e.source.value,
        translation: e.result.value,
        from: lastResult.from || e.from.value,
        to: lastResult.to || e.to.value,
        provider: lastResult.provider,
        favorite: true,
      });
      if (res.entry) {
        e.star.textContent = "★";
        e.status.textContent = "Saved to favorites";
        setTimeout(() => (e.status.textContent = ""), 1500);
      }
    });
  }

  async function activate(prefill) {
    await loadSettings();
    updateCounts();
    if (prefill?.source) {
      els().source.value = prefill.source;
      if (prefill.from) els().from.value = prefill.from;
      if (prefill.to) els().to.value = prefill.to;
      updateCounts();
      doTranslate();
    }
  }

  function scan() {
    activate();
  }

  return { id: "translate", page, bind, activate, scan };
})();
