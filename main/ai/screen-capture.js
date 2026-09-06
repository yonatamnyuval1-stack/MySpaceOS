const { desktopCapturer, screen, webContents, net } = require("electron");

const DEFAULT_MAX_WIDTH = 1400;
const DEFAULT_JPEG_QUALITY = 80;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function hideAiChatForCapture(win) {
  if (!win || win.isDestroyed()) return false;
  try {
    return await win.webContents.executeJavaScript(`
      (() => {
        const root = document.getElementById("ai-chat-root");
        if (!root) return false;
        root.dataset.aiCapturePrevVisibility = root.style.visibility || "";
        root.style.visibility = "hidden";
        return true;
      })()
    `);
  } catch {
    return false;
  }
}

async function restoreAiChatAfterCapture(win) {
  if (!win || win.isDestroyed()) return;
  try {
    await win.webContents.executeJavaScript(`
      (() => {
        const root = document.getElementById("ai-chat-root");
        if (!root) return;
        root.style.visibility = root.dataset.aiCapturePrevVisibility || "";
        delete root.dataset.aiCapturePrevVisibility;
      })()
    `);
  } catch {
  }
}

function nativeToJpegDataUrl(image, maxWidth, quality) {
  if (!image || image.isEmpty()) return null;
  let img = image;
  const size = img.getSize();
  if (size.width > maxWidth) {
    const scale = maxWidth / size.width;
    img = img.resize({
      width: maxWidth,
      height: Math.max(1, Math.round(size.height * scale)),
      quality: "better",
    });
  }
  const jpeg = img.toJPEG(quality);
  if (!jpeg?.length) return null;
  const out = img.getSize();
  return {
    dataUrl: `data:image/jpeg;base64,${jpeg.toString("base64")}`,
    width: out.width,
    height: out.height,
    bytes: jpeg.length,
  };
}

async function fetchImageAsDataUrl(url, maxWidth, quality) {
  const target = String(url || "").trim();
  if (!target || !/^https?:\/\//i.test(target)) return null;
  try {
    const res = await net.fetch(target, { method: "GET" });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > 8_000_000) return null;
    const { nativeImage } = require("electron");
    let image = nativeImage.createFromBuffer(buf);
    if (!image || image.isEmpty()) return null;
    return nativeToJpegDataUrl(image, Math.min(maxWidth, 900), quality);
  } catch {
    return null;
  }
}

async function probeVisibleApp(win) {
  if (!win || win.isDestroyed()) return null;
  try {
    return await win.webContents.executeJavaScript(`
      (() => {
        if (typeof window.MySpaceWorkspace?.getAiGuestHandle === "function") {
          const handle = window.MySpaceWorkspace.getAiGuestHandle();
          if (handle?.ok && handle.webContentsId != null) {
            return {
              webContentsId: handle.webContentsId,
              hostImageUrls: [],
              hasWebview: true,
              fromActiveTab: true,
            };
          }
        }

        const webviews = Array.from(document.querySelectorAll("webview"));
        const visible = webviews.find((wv) => {
          const r = wv.getBoundingClientRect();
          const st = window.getComputedStyle(wv);
          return r.width > 40 && r.height > 40 && st.display !== "none" && st.visibility !== "hidden";
        });
        let webContentsId = null;
        try {
          if (visible && typeof visible.getWebContentsId === "function") {
            webContentsId = visible.getWebContentsId();
          }
        } catch (_) {}

        const hostImgs = Array.from(document.querySelectorAll("#quiz-flag, img.flag-img, .flag-frame img, main img"))
          .map((img) => img.currentSrc || img.src)
          .filter((s) => s && /^https?:\\/\\//i.test(s));

        return {
          webContentsId,
          hostImageUrls: hostImgs.slice(0, 3),
          hasWebview: !!visible,
        };
      })()
    `);
  } catch {
    return null;
  }
}

async function probeGuestFocalImages(guestWc) {
  if (!guestWc || guestWc.isDestroyed()) return [];
  try {
    const urls = await guestWc.executeJavaScript(`
      (() => {
        const picks = [];
        const add = (el) => {
          if (!el) return;
          const s = el.currentSrc || el.src;
          if (s && /^https?:\\/\\//i.test(s)) picks.push(s);
        };
        add(document.getElementById("quiz-flag"));
        document.querySelectorAll("img.flag-img, .flag-frame img").forEach(add);
        if (!picks.length) {
          const imgs = Array.from(document.querySelectorAll("img"))
            .filter((img) => {
              const r = img.getBoundingClientRect();
              return r.width >= 80 && r.height >= 50;
            })
            .sort((a, b) => b.getBoundingClientRect().width * b.getBoundingClientRect().height
              - a.getBoundingClientRect().width * a.getBoundingClientRect().height);
          if (imgs[0]) add(imgs[0]);
        }
        return [...new Set(picks)].slice(0, 3);
      })()
    `);
    return Array.isArray(urls) ? urls : [];
  } catch {
    return [];
  }
}

async function captureWebContents(wc, maxWidth, quality) {
  if (!wc || wc.isDestroyed()) return null;
  try {
    const image = await wc.capturePage();
    const encoded = nativeToJpegDataUrl(image, maxWidth, quality);
    if (!encoded) return null;
    return { ...encoded, source: "webview" };
  } catch {
    return null;
  }
}

async function captureDisplay(maxWidth, quality) {
  try {
    const display = screen.getPrimaryDisplay();
    const { width, height } = display.size;
    const thumbW = Math.min(maxWidth, width);
    const thumbH = Math.max(1, Math.round((thumbW / width) * height));
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: thumbW, height: thumbH },
    });
    const primaryId = String(display.id);
    const src =
      sources.find((s) => String(s.display_id) === primaryId) ||
      sources.find((s) => /screen|entire|display/i.test(s.name)) ||
      sources[0];
    if (!src?.thumbnail || src.thumbnail.isEmpty()) return null;
    const encoded = nativeToJpegDataUrl(src.thumbnail, maxWidth, quality);
    if (!encoded) return null;
    return { ...encoded, source: "display" };
  } catch {
    return null;
  }
}

/**
 * @param {Electron.BrowserWindow|null} win
 * @param {{ maxWidth?: number, quality?: number, hideChat?: boolean, source?: "window"|"display"|"auto" }} [opts]
 */
async function captureScreenForAi(win, opts = {}) {
  const maxWidth = Math.min(1920, Math.max(480, Number(opts.maxWidth) || DEFAULT_MAX_WIDTH));
  const quality = Math.min(92, Math.max(40, Number(opts.quality) || DEFAULT_JPEG_QUALITY));
  const hideChat = opts.hideChat !== false;
  const prefer = opts.source === "display" ? "display" : opts.source === "window" ? "window" : "auto";

  if (prefer === "display") {
    const disp = await captureDisplay(maxWidth, quality);
    if (disp) return { ok: true, mimeType: "image/jpeg", images: [disp], ...disp };
    return { ok: false, error: "Display capture failed" };
  }

  if (!win || win.isDestroyed()) {
    return { ok: false, error: "Main window unavailable" };
  }

  let hidden = false;
  const images = [];
  try {
    if (hideChat) {
      hidden = await hideAiChatForCapture(win);
      if (hidden) await sleep(50);
    }

    const probe = await probeVisibleApp(win);
    let guestWc = null;
    if (probe?.webContentsId != null) {
      try {
        guestWc = webContents.fromId(Number(probe.webContentsId));
      } catch {
        guestWc = null;
      }
    }

    const focalUrls = [];
    if (guestWc) {
      focalUrls.push(...(await probeGuestFocalImages(guestWc)));
    }
    for (const u of probe?.hostImageUrls || []) {
      if (!focalUrls.includes(u)) focalUrls.push(u);
    }
    for (const url of focalUrls.slice(0, 2)) {
      const focal = await fetchImageAsDataUrl(url, maxWidth, Math.max(quality, 85));
      if (focal) images.push({ ...focal, source: "focal", url });
    }

    if (guestWc) {
      const pageShot = await captureWebContents(guestWc, maxWidth, quality);
      if (pageShot) images.push(pageShot);
    }

    if (prefer !== "display") {
      try {
        const winShot = nativeToJpegDataUrl(await win.capturePage(), maxWidth, quality);
        if (winShot) images.push({ ...winShot, source: "window" });
      } catch {
      }
    }

    if (!images.length) {
      const disp = await captureDisplay(maxWidth, quality);
      if (disp) images.push(disp);
    }

    if (!images.length) {
      return { ok: false, error: "No screenshot could be captured" };
    }

    const primary = images[0];
    return {
      ok: true,
      mimeType: "image/jpeg",
      dataUrl: primary.dataUrl,
      width: primary.width,
      height: primary.height,
      bytes: primary.bytes,
      source: primary.source,
      images,
    };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  } finally {
    if (hidden) await restoreAiChatAfterCapture(win);
  }
}

function imageContentParts(capture) {
  const list = capture?.images?.length ? capture.images : capture?.dataUrl ? [capture] : [];
  return list
    .filter((img) => img?.dataUrl)
    .slice(0, 2)
    .map((img) => ({
      type: "image_url",
      image_url: { url: img.dataUrl, detail: "high" },
    }));
}

function visionContentParts(capture) {
  const imgs = imageContentParts(capture);
  if (!imgs.length) return null;
  const sources = (capture.images || [capture]).map((i) => i.source).filter(Boolean).join("+");
  const text =
    `SCREENSHOT ATTACHED (${sources || capture.source || "screen"}, ` +
    `${capture.width}×${capture.height}). ` +
    `You CAN see these image(s). Look at them and answer. ` +
    `Never say you cannot see the flag/screen/image. Never ask the user to upload or describe it.`;
  return [{ type: "text", text }, ...imgs];
}

/** @deprecated prefer merging into the last user message via attachVisionToLastUser */
function visionUserMessage(capture, note) {
  const parts = visionContentParts(capture);
  if (!parts) return null;
  if (note) parts[0] = { type: "text", text: note };
  return { role: "user", content: parts };
}

function attachVisionToLastUser(messages, capture) {
  const parts = visionContentParts(capture);
  if (!parts || !Array.isArray(messages) || !messages.length) {
    return { messages, attached: false };
  }
  const out = messages.map((m) => ({ ...m }));
  let idx = -1;
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i]?.role === "user") {
      idx = i;
      break;
    }
  }
  if (idx < 0) {
    return { messages: [...out, { role: "user", content: parts }], attached: true };
  }
  const prev = out[idx].content;
  let userText = "";
  if (typeof prev === "string") userText = prev;
  else if (Array.isArray(prev)) {
    userText = prev
      .filter((p) => p?.type === "text")
      .map((p) => p.text)
      .join("\n");
  }
  out[idx] = {
    role: "user",
    content: [{ type: "text", text: userText || "(see attached screenshot)" }, ...parts.slice(1)],
  };
  out[idx].content = [
    {
      type: "text",
      text:
        (userText || "").trim() +
        "\n\n" +
        parts[0].text,
    },
    ...parts.slice(1),
  ];
  return { messages: out, attached: true };
}

module.exports = {
  captureScreenForAi,
  visionUserMessage,
  visionContentParts,
  attachVisionToLastUser,
  imageContentParts,
  DEFAULT_MAX_WIDTH,
  DEFAULT_JPEG_QUALITY,
};