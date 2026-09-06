const crypto = require("crypto");

const SCRYPT_OPTS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64, SCRYPT_OPTS);
}

function deriveKey(password, salt) {
  return crypto.scryptSync(String(password), salt, 32, SCRYPT_OPTS);
}

function encryptJson(key, data) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plain = Buffer.from(JSON.stringify(data), "utf8");
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

function decryptJson(key, blob) {
  const buf = Buffer.from(blob, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(enc), decipher.final()]);
  return JSON.parse(plain.toString("utf8"));
}

function verifyPassword(password, saltB64, hashB64) {
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  const actual = hashPassword(password, salt);
  return crypto.timingSafeEqual(actual, expected);
}

function createAuthRecord(password) {
  const salt = crypto.randomBytes(16);
  const hash = hashPassword(password, salt);
  return { salt: salt.toString("base64"), hash: hash.toString("base64") };
}

module.exports = {
  hashPassword,
  deriveKey,
  encryptJson,
  decryptJson,
  verifyPassword,
  createAuthRecord,
};
