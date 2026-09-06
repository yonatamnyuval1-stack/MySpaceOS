const { app, nativeImage } = require("electron");
const fs = require("fs");

const cache = new Map();

async function getFileIconDataUrl(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  const key = filePath.toLowerCase();
  if (cache.has(key)) {
    return cache.get(key);
  }

  try {
    const image = await app.getFileIcon(filePath, { size: "large" });
    const dataUrl = image.toDataURL();
    cache.set(key, dataUrl);
    return dataUrl;
  } catch {
    cache.set(key, null);
    return null;
  }
}

module.exports = { getFileIconDataUrl };