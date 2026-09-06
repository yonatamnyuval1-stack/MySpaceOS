window.RemoteHub = window.RemoteHub || {};

window.RemoteHub.escapeHtml = function (s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};

window.RemoteHub.invoke = async function (channel, args) {
  if (!window.myApp?.invoke) {
    throw new Error("Open via My Space (open.bat) for full remote features.");
  }
  const result = await window.myApp.invoke(channel, args || {});
  if (result?.ok === false && result?.error) {
    const err = new Error(result.error);
    if (result.code) err.code = result.code;
    throw err;
  }
  return result;
};

window.RemoteHub.uid = function () {
  return `rm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
};

window.RemoteHub.formatTime = function (iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "—";
  }
};

window.RemoteHub.CONNECTION_TYPES = [
  { id: "rdp", label: "Remote Desktop (RDP)", hint: "Built into Windows Pro: enable once on target, no install" },
  { id: "ssh", label: "SSH terminal", hint: "OpenSSH Server: optional Windows feature, enable via script" },
  { id: "psremoting", label: "PowerShell Remoting", hint: "WinRM built-in. Enable-PSRemoting on target" },
  { id: "explorer", label: "File share (Explorer)", hint: "Opens \\\\PC: needs network sharing enabled" },
  { id: "rustdesk", label: "RustDesk (optional)", hint: "Only if you installed RustDesk on both PCs" },
  { id: "custom", label: "Custom command", hint: "Your own launcher" },
];

window.RemoteHub.QUICK_ACTIONS = [
  { id: "control", label: "Control", icon: "🎮" },
  { id: "view", label: "Live view", icon: "👁" },
  { id: "rdp", label: "Desktop", icon: "🖥" },
  { id: "ssh", label: "SSH", icon: "⌨" },
  { id: "psremoting", label: "PowerShell", icon: "⚡" },
  { id: "explorer", label: "Files", icon: "📁" },
  { id: "winrs", label: "Run cmd", icon: "▶" },
];

window.RemoteHub.typeLabel = function (id) {
  return window.RemoteHub.CONNECTION_TYPES.find((t) => t.id === id)?.label || id;
};