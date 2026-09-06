const { SsrfErrorCodes } = require("@composio/core");
const { WholeWord } = require("lucide-static");

window.OsBridge = window.OsBridge || {};

window.OsBridge.invoke = async function (channel, args) {
  if (!window.myApp?.invoke) {
    throw new Error("Open OS Bridge inside My Space.");
  }
  const result = await window.myApp.invoke(channel, args || {});
  if (result && result.ok === false) {
    const err = new Error(result.error || "Request failed");
    err.result = result;
    throw err;
  }
  return result;
};

window.OsBridge.escapeHtml = function (s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};

window.OsBridge.formatBytes = function (n) {
  const v = Number(n) || 0;
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
  if (v < 1024 * 1024 * 1024) return `${(v / (1024 * 1024)).toFixed(1)} MB`;
  return `${(v / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

window.OsBridge.toast = function (msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = String(msg || "");
  el.hidden = false;
  clearTimeout(window.OsBridge._toastTimer);
  window.OsBridge._toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 3200);
};