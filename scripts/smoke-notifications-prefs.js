const assert = require("assert");
const path = require("path");
const os = require("os");
const fs = require("fs");

const tmp = path.join(os.tmpdir(), `my-space-notif-prefs-smoke-${Date.now()}`);
fs.mkdirSync(tmp, { recursive: true });

const { app } = require("electron");
app.setPath("userData", tmp);

const prefs = require("../main/apps/notifications-prefs");

let res = prefs.getPrefs();
assert.ok(res.ok);
assert.strictEqual(res.prefs.mailAlertsEnabled, true);

res = prefs.setPrefs({ mailAlertsEnabled: false });
assert.strictEqual(res.prefs.mailAlertsEnabled, false);

res = prefs.addBlockedSender({ email: "News <news@example.com>" });
assert.ok(res.ok);
assert.ok(res.prefs.blockedSenders.includes("news@example.com"));

assert.strictEqual(prefs.shouldNotifyMail("news@example.com"), false);
assert.strictEqual(prefs.shouldNotifyMail('"News" <news@example.com>'), false);

prefs.setPrefs({ mailAlertsEnabled: true });
assert.strictEqual(prefs.shouldNotifyMail("news@example.com"), false);

res = prefs.removeBlockedSender({ email: "news@example.com" });
assert.ok(res.ok);
assert.strictEqual(prefs.shouldNotifyMail("news@example.com"), true);

prefs.setPrefs({ mailAlertsEnabled: false });
assert.strictEqual(prefs.shouldNotifyMail("other@example.com"), false);

console.log("smoke-notifications-prefs: OK");
app.quit();
