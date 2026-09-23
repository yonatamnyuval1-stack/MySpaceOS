(function () {
  const input = document.getElementById("msb-input");
  const form = document.getElementById("msb-form");
  const resultsEl = document.getElementById("msb-results");
  const emptyEl = document.getElementById("msb-empty");
  const api = window.myspaceBrowser;
  const logoImg = document.querySelector(".msb-mark img");

  if (!api?.navigate || !api?.search) {
    const warn = document.createElement("p");
    warn.className = "msb-empty";
    warn.style.display = "block";
    warn.textContent =
      "Browser bridge missing — close this tab and reopen My Space Browser (or restart My Space).";
    document.querySelector(".msb-home")?.appendChild(warn);
  } else {
    void api.getHome?.().then((home) => {
      if (logoImg && home?.iconUrl) logoImg.src = home.iconUrl;
    });
  }

  let timer = null;
  let token = 0;
  let flat = [];
  let active = 0;

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function looksLikeUrl(q) {
    const s = String(q || "").trim();
    if (!s) return false;
    if (/^https?:\/\//i.test(s)) return true;
    if (/^[a-z0-9.-]+\.[a-z]{2,}([/:].*)?$/i.test(s)) return true;
    return false;
  }

  function normalizeUrl(q) {
    const s = String(q || "").trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;
    return `https://${s}`;
  }

  function groupOf(item) {
    if (item.kind === "connect-service") return "connect";
    if (item.kind === "app" || item.kind === "app-info") return "apps";
    if (item.kind === "url" || item.kind === "web") return "web";
    return "content";
  }

  function openItem(item) {
    if (!item || !api) return;
    if (item.kind === "url" || item.kind === "web") {
      api.navigate(item.url);
      return;
    }
    api.open(item);
  }

  function render(items, query) {
    flat = items.slice(0, 40);
    active = 0;
    const groups = {
      apps: [],
      connect: [],
      content: [],
      web: [],
    };
    for (const item of flat) {
      groups[groupOf(item)].push(item);
    }

    let any = false;
    resultsEl.querySelectorAll(".msb-group").forEach((section) => {
      const key = section.dataset.group;
      const list = section.querySelector(".msb-list");
      const rows = groups[key] || [];
      section.hidden = rows.length === 0;
      if (rows.length) any = true;
      list.innerHTML = rows
        .map((item) => {
          const idx = flat.indexOf(item);
          return `<button type="button" class="msb-item${idx === active ? " is-active" : ""}" data-index="${idx}">
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(item.subtitle || "")}</span>
            <em>${escapeHtml(item.kind || "")}</em>
          </button>`;
        })
        .join("");
    });

    resultsEl.hidden = !query;
    emptyEl.hidden = !query || any;
    listBind();
  }

  function listBind() {
    resultsEl.querySelectorAll(".msb-item").forEach((btn) => {
      btn.addEventListener("click", () => openItem(flat[Number(btn.dataset.index)]));
    });
  }

  function setActive(next) {
    if (!flat.length) return;
    active = Math.max(0, Math.min(flat.length - 1, next));
    resultsEl.querySelectorAll(".msb-item").forEach((btn) => {
      btn.classList.toggle("is-active", Number(btn.dataset.index) === active);
    });
  }

  async function runSearch(raw) {
    const q = String(raw || "").trim();
    if (!q) {
      render([], "");
      return;
    }
    const myToken = ++token;
    const extras = [];
    if (looksLikeUrl(q)) {
      extras.push({
        kind: "url",
        id: "url:" + q,
        title: `Open ${q}`,
        subtitle: "Website",
        url: normalizeUrl(q),
        rank: 200,
      });
    } else {
      extras.push({
        kind: "web",
        id: "web:" + q,
        title: `Search the web for “${q}”`,
        subtitle: "Google",
        url: `https://www.google.com/search?q=${encodeURIComponent(q)}`,
        rank: 15,
      });
    }

    let remote = [];
    try {
      const res = await api?.search?.(q);
      if (myToken !== token) return;
      remote = res?.ok ? res.results || [] : [];
    } catch {
      if (myToken !== token) return;
    }

    const merged = [...extras, ...remote].sort(
      (a, b) => (b.rank || 0) - (a.rank || 0) || String(a.title).localeCompare(String(b.title))
    );
    render(merged, q);
  }

  function schedule(q) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => runSearch(q), 120);
  }

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    if (!api?.navigate) {
      emptyEl.hidden = false;
      emptyEl.textContent = "Search unavailable.";
      resultsEl.hidden = false;
      return;
    }
    if (flat[active]) {
      openItem(flat[active]);
      return;
    }
    if (looksLikeUrl(q)) {
      api.navigate(normalizeUrl(q));
      return;
    }
    api.navigate(`https://www.google.com/search?q=${encodeURIComponent(q)}`);
  });

  input?.addEventListener("input", () => schedule(input.value));
  input?.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(active + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(active - 1);
    }
  });

  document.getElementById("msb-chips")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-q]");
    if (!btn) return;
    input.value = btn.dataset.q;
    input.focus();
    runSearch(btn.dataset.q);
  });

  async function loadBookmarks() {
    const section = document.getElementById("msb-bookmarks");
    const row = document.getElementById("msb-bookmark-row");
    if (!section || !row || !api?.listBookmarks) return;
    try {
      const res = await api.listBookmarks();
      const list = Array.isArray(res?.bookmarks) ? res.bookmarks : [];
      if (!list.length) {
        section.hidden = true;
        row.innerHTML = "";
        return;
      }
      section.hidden = false;
      row.innerHTML = list
        .map((b) => {
          const name = escapeHtml(b.name || b.url);
          const url = escapeHtml(b.url);
          const icon = b.iconUrl
            ? `<img src="${escapeHtml(b.iconUrl)}" alt="" width="16" height="16" />`
            : "";
          return `<button type="button" class="msb-bookmark" data-url="${url}">${icon}<span>${name}</span></button>`;
        })
        .join("");
    } catch {
      section.hidden = true;
    }
  }

  document.getElementById("msb-bookmark-row")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-url]");
    if (!btn || !api?.navigate) return;
    api.navigate(btn.dataset.url);
  });

  void loadBookmarks();
})();