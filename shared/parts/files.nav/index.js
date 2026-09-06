function normalizePath(p) {
  return String(p || "")
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "") || "";
}

function parentDir(p) {
  const n = normalizePath(p);
  if (!n) return "";
  const idx = n.lastIndexOf("/");
  if (idx <= 0) {
    if (/^[a-zA-Z]:$/.test(n)) return "";
    return "";
  }
  if (/^[a-zA-Z]:\//.test(n) && idx === 2) return n.slice(0, 2);
  return n.slice(0, idx) || "";
}

function crumbsFor(dirPath) {
  const n = normalizePath(dirPath);
  if (!n) return [];
  const parts = [];
  let cur = n;
  const seen = new Set();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const name = cur.includes("/") ? cur.slice(cur.lastIndexOf("/") + 1) : cur;
    parts.unshift({ name: name || cur, path: cur });
    const up = parentDir(cur);
    if (!up || up === cur) break;
    cur = up;
  }
  if (parts.length > 8) {
    return [parts[0], { name: "…", path: "" }, ...parts.slice(-6)];
  }
  return parts;
}

function asBytes(buf) {
  if (!buf) return null;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(buf)) return buf;
  if (buf instanceof Uint8Array) return buf;
  return null;
}

function decodeTextBuffer(buf) {
  const b = asBytes(buf);
  if (!b || !b.length) return { text: "", encoding: "utf8" };

  const toUtf8 = (arr) => {
    if (typeof Buffer !== "undefined" && Buffer.isBuffer(arr)) return arr.toString("utf8");
    if (typeof TextDecoder !== "undefined") return new TextDecoder("utf-8").decode(arr);
    return String.fromCharCode(...arr);
  };
  const toUtf16le = (arr) => {
    if (typeof Buffer !== "undefined" && Buffer.isBuffer(arr)) return arr.toString("utf16le");
    if (typeof TextDecoder !== "undefined") return new TextDecoder("utf-16le").decode(arr);
    let s = "";
    for (let i = 0; i + 1 < arr.length; i += 2) s += String.fromCharCode(arr[i] | (arr[i + 1] << 8));
    return s;
  };

  if (b.length >= 2 && b[0] === 0xff && b[1] === 0xfe) {
    return { text: toUtf16le(b.slice(2)), encoding: "utf16le" };
  }
  if (b.length >= 2 && b[0] === 0xfe && b[1] === 0xff) {
    const swapped = new Uint8Array(b.length - 2);
    for (let i = 2; i + 1 < b.length; i += 2) {
      swapped[i - 2] = b[i + 1];
      swapped[i - 1] = b[i];
    }
    return { text: toUtf16le(swapped), encoding: "utf16be" };
  }
  if (b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) {
    return { text: toUtf8(b.slice(3)), encoding: "utf8" };
  }
  const sample = b.subarray(0, Math.min(b.length, 4096));
  let oddNull = 0;
  let evenNull = 0;
  for (let i = 0; i < sample.length; i += 1) {
    if (sample[i] === 0) {
      if (i % 2 === 0) evenNull += 1;
      else oddNull += 1;
    }
  }
  const pairs = Math.floor(sample.length / 2);
  if (pairs > 8 && oddNull / pairs > 0.6 && evenNull / pairs < 0.15) {
    return { text: toUtf16le(b), encoding: "utf16le" };
  }
  return { text: toUtf8(b), encoding: "utf8" };
}

function looksLikeBinary(buf) {
  const b = asBytes(buf);
  if (!b || !b.length) return false;
  const sample = b.subarray(0, Math.min(b.length, 8192));
  let nulls = 0;
  let weird = 0;
  for (let i = 0; i < sample.length; i += 1) {
    const v = sample[i];
    if (v === 0) nulls += 1;
    else if (v < 7 || (v > 13 && v < 32 && v !== 27)) weird += 1;
  }
  if (nulls / sample.length > 0.02 && nulls > 4) return true;
  if (weird / sample.length > 0.3) return true;
  return false;
}

const api = { normalizePath, parentDir, crumbsFor, decodeTextBuffer, looksLikeBinary };

if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.PartsFilesNav = api;