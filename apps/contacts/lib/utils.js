window.Contacts = window.Contacts || {};

window.Contacts.escapeHtml = function (s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};

window.Contacts.invoke = async function (channel, args) {
  if (!window.myApp?.invoke) throw new Error("Open via My Space.");
  const result = await window.myApp.invoke(channel, args || {});
  if (result?.ok === false && result?.error) throw new Error(result.error);
  return result;
};

window.Contacts.uid = function (prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
};

window.Contacts.displayName = function (c) {
  if (!c) return "";
  if (c.displayName?.trim()) return c.displayName.trim();
  return [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || "Unnamed";
};

window.Contacts.formatTime = function (iso) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "";
  }
};

window.Contacts.formatBirthday = function (bday) {
  if (!bday) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(bday)) {
    const d = new Date(bday + "T12:00:00");
    return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  }
  if (/^\d{2}-\d{2}$/.test(bday)) {
    const [m, d] = bday.split("-");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`;
  }
  return bday;
};

window.Contacts.ICON_PICKS = ["👤", "👨", "👩", "🧑", "👴", "👵", "🧒", "👦", "👧", "💼", "🏥", "🎓", "⭐", "❤", "🐕"];