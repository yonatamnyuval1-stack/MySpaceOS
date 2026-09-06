function DraftStore(storage, key = "parts.chat.drafts") {
  const store = storage && typeof storage.getItem === "function" ? storage : null;
  let map = {};
  if (store) {
    try {
      map = JSON.parse(store.getItem(key) || "{}") || {};
    } catch {
      map = {};
    }
  }

  function persist() {
    if (!store) return;
    try {
      store.setItem(key, JSON.stringify(map));
    } catch {
      /* quota */
    }
  }

  return {
    get(id) {
      return map[String(id || "")] || "";
    },
    set(id, text) {
      const k = String(id || "");
      if (!k) return;
      const v = String(text || "");
      if (!v) delete map[k];
      else map[k] = v;
      persist();
    },
    clear(id) {
      delete map[String(id || "")];
      persist();
    },
    all() {
      return { ...map };
    },
  };
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

const api = { DraftStore, debounce };
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.PartsChatDrafts = api;