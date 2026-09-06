window.Profiles = window.Profiles || {};

window.Profiles.escapeHtml = function (s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};

window.Profiles.invoke = async function (channel, args) {
  if (!window.myApp?.invoke) {
    throw new Error("Open via My Space for full features.");
  }
  const result = await window.myApp.invoke(channel, args || {});
  if (result?.ok === false && result?.error) throw new Error(result.error);
  return result;
};

window.Profiles.uid = function (prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
};

window.Profiles.formatTime = function (iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "—";
  }
};

window.Profiles.ICON_PICKS = ["◆", "★", "🔗", "🌐", "🔐", "🚀", "👤", "💼", "📧", "💳", "🎮", "📱", "🛠", "📁", "💡", "🏠", "🎯", "📊", "🐙", "⚡"];
