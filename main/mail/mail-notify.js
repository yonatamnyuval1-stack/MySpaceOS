function pushNewMailNotifications(account, messages) {
  let push;
  let shouldNotifyMail;
  let parseSenderEmail;
  try {
    push = require("../apps/notifications-center").push;
    const prefs = require("../apps/notifications-prefs");
    shouldNotifyMail = prefs.shouldNotifyMail;
    parseSenderEmail = prefs.parseSenderEmail;
  } catch {
    return;
  }

  for (const msg of messages || []) {
    if (!msg?.id) continue;
    if (!shouldNotifyMail(msg.from)) continue;
    const fromRaw = String(msg.from || "");
    const fromName = fromRaw.replace(/<[^>]+>/, "").trim() || fromRaw || "Unknown";
    const fromEmail = typeof parseSenderEmail === "function" ? parseSenderEmail(fromRaw) : "";
    push(
      {
        appId: "mail",
        type: "mail-new",
        title: `${fromName} — ${msg.subject || "New mail"}`,
        body: msg.snippet || "",
        dedupeKey: `mail:${account.id}:${msg.id}`,
        priority: "high",
        route: {
          action: "open-mail",
          accountId: account.id,
          messageId: msg.id,
          provider: account.provider,
          from: fromRaw,
          fromEmail: fromEmail || null,
          fromName: fromName || null,
        },
      },
      { showOs: true, bypassFocus: false }
    );
  }
}

module.exports = { pushNewMailNotifications };
