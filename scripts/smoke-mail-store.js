const assert = require("assert");
const path = require("path");
const os = require("os");
const fs = require("fs");

const tmp = path.join(os.tmpdir(), `my-space-mail-smoke-${Date.now()}`);
fs.mkdirSync(tmp, { recursive: true });

const electron = require("electron");
const { app } = electron;
app.setPath("userData", tmp);

const store = require("../main/mail/mail-store");
const { listProviders } = require("../main/mail/providers");

const acc = store.upsertAccount({
  provider: "gmail",
  email: "test@example.com",
  displayName: "Test",
});
assert.ok(acc.ok, acc.error);

store.setTokens(acc.account.id, {
  accessToken: "access_test",
  refreshToken: "refresh_test",
  expiresAt: Date.now() + 3600000,
});

const loaded = store.getTokens(acc.account.id);
assert.equal(loaded.accessToken, "access_test");
assert.equal(loaded.refreshToken, "refresh_test");

const pub = store.listAccountsPublic();
assert.equal(pub.length, 1);
assert.equal(pub[0].email, "test@example.com");
assert.equal(pub[0].hasTokens, true);

const providers = listProviders();
assert.ok(providers.some((p) => p.id === "gmail"));
assert.ok(providers.some((p) => p.id === "microsoft"));

store.removeAccount(acc.account.id);
assert.equal(store.listAccountsPublic().length, 0);
assert.equal(store.getTokens(acc.account.id), null);

console.log("mail store ok");
app.exit(0);