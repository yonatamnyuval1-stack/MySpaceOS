const crypto = require("crypto");
const { app } = require("electron");
const { encryptJson, decryptJson } = require("../apps/vault-crypto");

function mailKey() {
  const seed = `${app.getPath("userData")}|${app.getName()}|my-space-mail-v1`;
  return crypto.createHash("sha256").update(seed, "utf8").digest();
}

function encryptTokens(payload) {
  return encryptJson(mailKey(), payload);
}

function decryptTokens(blob) {
  return decryptJson(mailKey(), blob);
}

module.exports = { encryptTokens, decryptTokens };