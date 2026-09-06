window.Console = window.Console || {};

window.Console.invoke = async function (channel, args) {
  if (!window.myApp?.invoke) throw new Error("Open via My Space.");
  const result = await window.myApp.invoke(channel, args || {});
  if (result?.ok === false && result?.error) throw new Error(result.error);
  return result;
};

window.Console.escapeHtml = function (s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};

window.Console.formatTime = function (iso) {
  if (!iso) return ":";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

window.Console.showToast = function (message, ms = 2800) {
  let el = document.getElementById("console-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "console-toast";
    el.className = "console-toast hidden";
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.remove("hidden");
  clearTimeout(window.Console._toastTimer);
  window.Console._toastTimer = setTimeout(() => el.classList.add("hidden"), ms);
};

window.Console.filterItems = function (items, query, fields) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) =>
    fields.some((f) => String(item[f] ?? "").toLowerCase().includes(q))
  );
};
