function ensureStyles(doc) {
  if (doc.getElementById("parts-ui-omnibox-css")) return;
  const link = doc.createElement("link");
  link.id = "parts-ui-omnibox-css";
  link.rel = "stylesheet";
  link.href = (typeof __dirname !== "undefined" ? "" : "") || "parts/ui.omnibox/styles.css";
  const style = doc.createElement("style");
  style.id = "parts-ui-omnibox-css";
  style.textContent = `
.parts-omnibox{display:flex;flex-direction:column;gap:6px;width:100%;font:14px/1.4 system-ui,sans-serif}
.parts-omnibox-input{width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:10px 12px;background:rgba(0,0,0,.25);color:inherit;outline:none}
.parts-omnibox-input:focus{border-color:rgba(167,139,250,.55)}
.parts-omnibox-list{margin:0;padding:0;list-style:none;max-height:240px;overflow:auto;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:rgba(0,0,0,.2)}
.parts-omnibox-list:empty{display:none}
.parts-omnibox-item{display:flex;flex-direction:column;gap:2px;width:100%;text-align:left;border:0;background:transparent;color:inherit;padding:8px 10px;cursor:pointer}
.parts-omnibox-item:hover,.parts-omnibox-item.is-active{background:rgba(167,139,250,.14)}
.parts-omnibox-item strong{font-weight:600;font-size:.9rem}
.parts-omnibox-item span{font-size:.75rem;opacity:.7}
`;
  doc.head.appendChild(style);
}

/**
 * @param {HTMLElement} rootEl
 * @param {{
 *   placeholder?: string,
 *   debounceMs?: number,
 *   search: (q: string) => Promise<Array<{id?:string,label:string,hint?:string}>> | Array<{id?:string,label:string,hint?:string}>,
 *   onPick?: (item: any) => void
 * }} opts
 */
function mount(rootEl, opts = {}) {
  if (!rootEl) throw new Error("omnibox: root element required");
  const doc = rootEl.ownerDocument || document;
  ensureStyles(doc);

  const searchFn = typeof opts.search === "function" ? opts.search : async () => [];
  const onPick = typeof opts.onPick === "function" ? opts.onPick : () => {};
  const debounceMs = Math.max(0, Number(opts.debounceMs) || 120);

  rootEl.classList.add("parts-omnibox");
  rootEl.innerHTML = "";
  const input = doc.createElement("input");
  input.type = "search";
  input.className = "parts-omnibox-input";
  input.placeholder = opts.placeholder || "Search…";
  input.autocomplete = "off";
  input.spellcheck = false;
  const list = doc.createElement("ul");
  list.className = "parts-omnibox-list";
  list.setAttribute("role", "listbox");
  rootEl.append(input, list);

  let timer = null;
  let active = -1;
  let items = [];

  function paint() {
    list.innerHTML = "";
    items.forEach((item, i) => {
      const li = doc.createElement("li");
      const btn = doc.createElement("button");
      btn.type = "button";
      btn.className = `parts-omnibox-item${i === active ? " is-active" : ""}`;
      btn.innerHTML = `<strong></strong>${item.hint ? "<span></span>" : ""}`;
      btn.querySelector("strong").textContent = item.label || String(item.id || "");
      if (item.hint) btn.querySelector("span").textContent = item.hint;
      btn.addEventListener("click", () => onPick(item));
      li.appendChild(btn);
      list.appendChild(li);
    });
  }

  async function run(q) {
    try {
      const res = await searchFn(String(q || "").trim());
      items = Array.isArray(res) ? res.slice(0, 40) : [];
    } catch {
      items = [];
    }
    active = items.length ? 0 : -1;
    paint();
  }

  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => void run(input.value), debounceMs);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!items.length) return;
      active = (active + 1) % items.length;
      paint();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!items.length) return;
      active = (active - 1 + items.length) % items.length;
      paint();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && items[active]) onPick(items[active]);
    } else if (e.key === "Escape") {
      list.innerHTML = "";
      items = [];
      active = -1;
    }
  });

  return {
    focus: () => input.focus(),
    clear: () => {
      input.value = "";
      items = [];
      paint();
    },
    destroy: () => {
      clearTimeout(timer);
      rootEl.innerHTML = "";
    },
  };
}

const api = { mount };
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.PartsUiOmnibox = api;