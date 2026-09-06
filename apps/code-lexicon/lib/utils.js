window.Lexicon = window.Lexicon || {};

window.Lexicon.invoke = async function (channel, args) {
  if (!window.myApp?.invoke) throw new Error("Open via My Space.");
  const result = await window.myApp.invoke(channel, args || {});
  if (result?.ok === false && result?.error) throw new Error(result.error);
  return result;
};

window.Lexicon.escapeHtml = function (text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};

window.Lexicon.levelLabel = function (level) {
  return { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" }[level] || level;
};

window.Lexicon.levelClass = function (level) {
  return `level-${level || "intermediate"}`;
};

window.Lexicon.CATEGORIES = [
  { id: "all", label: "All topics", icon: "📚" },
  { id: "fundamentals", label: "CS Fundamentals", icon: "📐" },
  { id: "languages", label: "Languages", icon: "💻" },
  { id: "web", label: "Web", icon: "🌐" },
  { id: "algorithms", label: "Algorithms", icon: "🧮" },
  { id: "databases", label: "Databases", icon: "🗄️" },
  { id: "devops", label: "DevOps", icon: "☁️" },
  { id: "security", label: "Security", icon: "🔒" },
  { id: "networking", label: "Networking", icon: "🔗" },
  { id: "architecture", label: "Architecture", icon: "🏛️" },
  { id: "testing", label: "Testing", icon: "🧪" },
  { id: "tools", label: "Tools", icon: "🛠️" },
  { id: "ai", label: "AI & Data", icon: "🤖" },
  { id: "mobile", label: "Mobile", icon: "📱" },
  { id: "os", label: "Operating Systems", icon: "🖥️" },
  { id: "formats", label: "Formats & Protocols", icon: "📄" },
];

window.Lexicon.categoryMeta = function (id) {
  return window.Lexicon.CATEGORIES.find((c) => c.id === id) || { id, label: id, icon: "📁" };
};

window.Lexicon.debounce = function (fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

window.Lexicon.googleUrl = function (term) {
  return `https://www.google.com/search?q=${encodeURIComponent(term + " programming")}`;
};

window.Lexicon.mdnUrl = function (term) {
  return `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(term)}`;
};
