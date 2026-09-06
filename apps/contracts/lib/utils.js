window.Contracts = window.Contracts || {};

window.Contracts.escapeHtml = function (s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};

window.Contracts.invoke = async function (channel, args) {
  if (!window.myApp?.invoke) throw new Error("Open via My Space.");
  const result = await window.myApp.invoke(channel, args || {});
  if (result?.ok === false && result?.error) throw new Error(result.error);
  return result;
};

window.Contracts.statusLabel = function (status) {
  const map = {
    draft: "Draft",
    pending: "Pending signatures",
    signed: "Fully signed",
    expired: "Expired",
  };
  return map[status] || status;
};

window.Contracts.statusClass = function (status) {
  return `status-${status}`;
};
