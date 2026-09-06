window.Coupons = window.Coupons || {};

window.Coupons.escapeHtml = function (s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};

window.Coupons.invoke = async function (channel, args) {
  if (!window.myApp?.invoke) throw new Error("Open via My Space.");
  const result = await window.myApp.invoke(channel, args || {});
  if (result?.ok === false && result?.error) throw new Error(result.error);
  return result;
};

window.Coupons.uid = function (prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
};

window.Coupons.formatDate = function (iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
};

window.Coupons.TYPE_META = {
  gift: { label: "Gift card", icon: "🎁" },
  voucher: { label: "Voucher", icon: "🎟️" },
  promo: { label: "Promo code", icon: "🏷️" },
  membership: { label: "Membership", icon: "💳" },
};
