const { webContents } = require("electron");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildPageContentScript(maxChars) {
  const n = Math.min(Math.max(Number(maxChars) || 8000, 500), 20000);
  return `(() => {
      const max = ${n};
      const clean = (s) => String(s || "").replace(/\\s+/g, " ").trim();
      const uniq = (arr) => {
        const out = [];
        const seen = new Set();
        for (const item of arr) {
          const key = String(item).toLowerCase();
          if (!item || seen.has(key)) continue;
          seen.add(key);
          out.push(item);
        }
        return out;
      };
      const headings = uniq(
        Array.from(document.querySelectorAll("h1, h2, h3, [role='heading']"))
          .map((el) => clean(el.innerText || el.textContent))
          .filter((t) => t && t.length < 200)
      ).slice(0, 25);
      const navLabels = uniq(
        Array.from(
          document.querySelectorAll(
            "nav a, nav button, [role='navigation'] a, [role='navigation'] button, header nav a, .nav-item, [data-page].nav-item, aside a, aside button"
          )
        )
          .map((el) => clean(el.innerText || el.textContent || el.getAttribute("aria-label")))
          .filter((t) => t && t.length < 80)
      ).slice(0, 40);
      const activeNav =
        clean(
          document.querySelector(".nav-item.active, [aria-current='page'], a.active, button.active")
            ?.innerText ||
            document.querySelector(".nav-item.active, [aria-current='page']")?.getAttribute("aria-label")
        ) || null;
      const root =
        document.querySelector("main") ||
        document.querySelector(".app-main") ||
        document.querySelector(".content") ||
        document.body;
      let text = String(root?.innerText || document.body?.innerText || "")
        .replace(/[ \\t]+\\n/g, "\\n")
        .replace(/\\n{3,}/g, "\\n\\n")
        .trim();
      const selected = String(window.getSelection?.()?.toString?.() || "").trim();
      const truncated = text.length > max;
      if (truncated) text = text.slice(0, max);

      const flagRe = /flagcdn\\.com\\/(?:[wh]\\d+\\/)?([a-z]{2})(?:[@./?]|$)/i;
      const countries = window.FlagQuizData?.countries || [];
      const byCode = new Map(countries.map((c) => [c.code, c]));

      function decorateImage(img, force) {
        const src = String(img.currentSrc || img.src || img.getAttribute("src") || "").trim();
        if (!src || src.startsWith("data:image/svg")) return null;
        const r = img.getBoundingClientRect();
        const st = window.getComputedStyle(img);
        if (!force) {
          if (r.width < 20 || r.height < 14) return null;
          if (st.display === "none" || st.visibility === "hidden") return null;
        }
        const entry = {
          src: src.slice(0, 500),
          alt: clean(img.alt).slice(0, 120) || null,
          width: Math.round(r.width),
          height: Math.round(r.height),
          id: img.id || null,
          className: clean(img.className).slice(0, 80) || null,
        };
        const fm = src.match(flagRe);
        if (fm) {
          const code = fm[1].toLowerCase();
          entry.flagCode = code;
          const c = byCode.get(code);
          if (c) {
            entry.flagCountry = c.name;
            entry.flagCountryHe = c.nameHe || null;
          }
        }
        return entry;
      }

      const media = [];
      const seenSrc = new Set();
      const pushMedia = (entry) => {
        if (!entry?.src || seenSrc.has(entry.src)) return;
        seenSrc.add(entry.src);
        media.push(entry);
      };

      for (const sel of ["#quiz-flag", "img.flag-img", ".flag-frame img", "[data-ai-focal] img", "img[data-ai-focal]"]) {
        document.querySelectorAll(sel).forEach((img) => pushMedia(decorateImage(img, true)));
      }
      Array.from(document.querySelectorAll("img")).forEach((img) => pushMedia(decorateImage(img, false)));
      media.sort((a, b) => b.width * b.height - a.width * a.height);

      const answerChoices = Array.from(
        document.querySelectorAll(".answer-btn, [data-code].answer-btn, .answers button")
      )
        .map((el) => ({
          label: clean(el.innerText || el.textContent),
          code: el.dataset?.code || null,
        }))
        .filter((x) => x.label);

      const buttons = uniq(
        Array.from(document.querySelectorAll("main button, .page.active button, [role='button']"))
          .map((el) => clean(el.innerText || el.getAttribute("aria-label")))
          .filter((t) => t && t.length < 60)
      ).slice(0, 25);

      let quizFlag = null;
      try {
        const live = window.FlagQuizApp?.getCurrentFlag?.();
        if (live?.code) {
          quizFlag = {
            src: live.flag || null,
            flagCode: live.code,
            flagCountry: live.name,
            flagCountryHe: live.nameHe || null,
            quizIndex: live.index,
            quizTotal: live.total,
            fromQuizState: true,
          };
        }
      } catch (_) {}

      const primaryFlag =
        quizFlag ||
        media.find((m) => m.id === "quiz-flag" || (m.className || "").includes("flag-img")) ||
        media.find((m) => m.flagCode) ||
        null;

      return {
        text,
        truncated,
        charCount: text.length,
        selectedText: selected ? selected.slice(0, 1000) : null,
        title: document.title || null,
        headings,
        navLabels,
        activeNav,
        buttons,
        url: location.href || null,
        media: media.slice(0, 16),
        answerChoices: answerChoices.slice(0, 8),
        primaryFlag,
        quizFlag,
        readyState: document.readyState || null,
      };
    })()`;
}

async function waitForGuestReady(guestWc, timeoutMs = 4000) {
  if (!guestWc || guestWc.isDestroyed()) return false;
  try {
    if (!guestWc.isLoading()) {
      const state = await guestWc.executeJavaScript("document.readyState", true);
      if (state === "interactive" || state === "complete") return true;
    }
  } catch {
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        guestWc.removeListener?.("did-finish-load", onLoad);
        guestWc.removeListener?.("dom-ready", onReady);
      } catch {
      }
      resolve(ok);
    };
    const onLoad = () => finish(true);
    const onReady = () => finish(true);
    const timer = setTimeout(() => finish(false), timeoutMs);
    try {
      guestWc.once?.("did-finish-load", onLoad);
      guestWc.once?.("dom-ready", onReady);
    } catch {
      finish(false);
    }
  });
}

async function probeActiveGuestHandle(win) {
  if (!win || win.isDestroyed()) return { ok: false, error: "Main window unavailable" };
  try {
    return await win.webContents.executeJavaScript(
      `
      (() => {
        if (typeof window.MySpaceWorkspace?.getAiGuestHandle === "function") {
          return window.MySpaceWorkspace.getAiGuestHandle();
        }
        return { ok: false, error: "getAiGuestHandle unavailable" };
      })()
    `,
      true
    );
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

function guestFromHandle(handle) {
  if (handle?.webContentsId == null) return null;
  try {
    const guestWc = webContents.fromId(Number(handle.webContentsId));
    if (!guestWc || guestWc.isDestroyed()) return null;
    return guestWc;
  } catch {
    return null;
  }
}

function formatPageResult(content, active, via) {
  return {
    ok: true,
    via,
    active: {
      ...(active || {}),
      pageTitle: content.title || active?.pageTitle || active?.title || null,
      url: content.url || active?.url || null,
    },
    text: content.text || "",
    truncated: !!content.truncated,
    charCount: content.charCount || 0,
    selectedText: content.selectedText || null,
    headings: Array.isArray(content.headings) ? content.headings : [],
    navLabels: Array.isArray(content.navLabels) ? content.navLabels : [],
    activeNav: content.activeNav || null,
    media: Array.isArray(content.media) ? content.media : [],
    answerChoices: Array.isArray(content.answerChoices) ? content.answerChoices : [],
    buttons: Array.isArray(content.buttons) ? content.buttons : [],
    primaryFlag: content.primaryFlag || content.quizFlag || null,
    quizFlag: content.quizFlag || null,
  };
}

/**
 * @param {Electron.BrowserWindow|null} win
 * @param {number} [maxChars]
 */
async function readGuestPageContent(win, maxChars = 8000) {
  if (!win || win.isDestroyed()) {
    return { ok: false, error: "Main window unavailable" };
  }

  let handle = await probeActiveGuestHandle(win);
  if (!handle?.ok) {
    return {
      ok: false,
      error: handle?.error || "Could not locate active guest view",
      view: handle?.view,
      active: handle?.active || undefined,
    };
  }

  let guestWc = guestFromHandle(handle);
  if (!guestWc) {
    await sleep(200);
    handle = await probeActiveGuestHandle(win);
    guestWc = guestFromHandle(handle);
  }
  if (!guestWc) {
    return {
      ok: false,
      error: "Guest webContents unavailable (view not attached yet).",
      active: handle?.active || undefined,
    };
  }

  const loading = (() => {
    try {
      return !!guestWc.isLoading?.();
    } catch {
      return false;
    }
  })();
  if (loading || handle.isLoading) {
    await waitForGuestReady(guestWc, 4000);
  }

  const script = buildPageContentScript(maxChars);
  const attempts = 3;
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const content = await guestWc.executeJavaScript(script, true);
      if (content && typeof content === "object") {
        return formatPageResult(content, handle.active, "guest-webcontents");
      }
      lastErr = "Guest returned no content object";
    } catch (err) {
      lastErr = err?.message || String(err);
    }
    if (i < attempts - 1) {
      await waitForGuestReady(guestWc, 1500);
      await sleep(150);
    }
  }

  return {
    ok: false,
    error: lastErr || "Could not read guest page content",
    active: handle.active || undefined,
  };
}

module.exports = {
  buildPageContentScript,
  readGuestPageContent,
  probeActiveGuestHandle,
};
