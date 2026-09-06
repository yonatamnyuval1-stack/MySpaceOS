window.SysInfo = window.SysInfo || {};

window.SysInfo.escapeHtml = function (s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};

window.SysInfo.formatBytes = function (bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
};

window.SysInfo.formatTime = function (iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "—";
  }
};

window.SysInfo.invoke = async function (channel, args) {
  if (!window.myApp?.invoke) {
    throw new Error("App bridge unavailable — open via My Space (open.bat)");
  }
  const result = await window.myApp.invoke(channel, args || {});
  if (result?.ok === false && result?.error) {
    throw new Error(result.error);
  }
  return result;
};

window.SysInfo.renderStatCards = function (container, cards) {
  if (!container) return;
  container.innerHTML = cards
    .map(
      (c) => `
    <article class="stat-card ${c.cls || ""}">
      <div class="stat-label">${window.SysInfo.escapeHtml(c.label)}</div>
      <div class="stat-value">${window.SysInfo.escapeHtml(String(c.value))}</div>
      ${c.hint ? `<span class="stat-hint">${window.SysInfo.escapeHtml(c.hint)}</span>` : ""}
    </article>`
    )
    .join("");
};

window.SysInfo.setupSortableTable = function (table, onSort) {
  if (!table) return;
  table.querySelectorAll("th[data-sort]").forEach((th) => {
    th.addEventListener("click", () => onSort(th.dataset.sort, th));
  });
};

window.SysInfo.updateSortHeaders = function (table, sortKey, sortDir) {
  table?.querySelectorAll("th[data-sort]").forEach((th) => {
    th.classList.remove("sorted", "desc");
    if (th.dataset.sort === sortKey) {
      th.classList.add("sorted");
      if (sortDir === "desc") th.classList.add("desc");
    }
  });
};

window.SysInfo.compare = function (a, b, key, dir, numericKeys) {
  let av = a[key];
  let bv = b[key];
  if (numericKeys.has(key)) {
    av = Number(av) || 0;
    bv = Number(bv) || 0;
  } else {
    av = String(av || "").toLowerCase();
    bv = String(bv || "").toLowerCase();
  }
  if (av < bv) return dir === "asc" ? -1 : 1;
  if (av > bv) return dir === "asc" ? 1 : -1;
  return 0;
};
