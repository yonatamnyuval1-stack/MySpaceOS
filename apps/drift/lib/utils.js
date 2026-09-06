window.Drift = window.Drift || {};

window.Drift.invoke = async function (channel, args) {
  if (!window.myApp?.invoke) throw new Error("Open via My Space.");
  const result = await window.myApp.invoke(channel, args || {});
  if (result?.ok === false && result?.error) throw new Error(result.error);
  return result;
};

window.Drift.escapeHtml = function (text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};

window.Drift.formatWhen = function (iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `Today ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " + time;
};

window.Drift.debounce = function (fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

window.Drift.EVENT_FILTERS = [
  { id: "all", label: "All events" },
  { id: "new_file", label: "New files" },
  { id: "modified_file", label: "Modified" },
  { id: "deleted_file", label: "Deleted files" },
  { id: "deleted_folder", label: "Deleted folders" },
  { id: "new_folder", label: "Folders" },
  { id: "new_project", label: "Projects" },
  { id: "myspace_app", label: "My Space apps" },
  { id: "myspace_config", label: "My Space config" },
  { id: "git_commit", label: "Git commits" },
  { id: "scan_complete", label: "Scans" },
];

window.Drift.TIME_FILTERS = [
  { id: 0, label: "All time" },
  { id: 1, label: "Today" },
  { id: 7, label: "This week" },
  { id: 30, label: "This month" },
];
