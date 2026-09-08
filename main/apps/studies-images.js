const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { app } = require("electron");

const WM_ROOT = path.join(__dirname, "..", "..", "world-maps");
const { geminiGenerate } = require(path.join(WM_ROOT, "gemini-ipc.js"));

const UA = "MySpaceStudies/1.0 (desktop education app; image attribution respected)";
const CACHE_VERSION = 1;
const VISION_MIN_SCORE = 0.62;
const MAX_CANDIDATES = 10;
const MAX_VISION_CHECKS = 5;

let memoryCache = new Map();

function cachePath() {
  try {
    const profile = require("../myspace-profile");
    return profile.profileScopedPath("studies-image-cache.json");
  } catch {
    return path.join(require("os").tmpdir(), "myspace-studies-image-cache.json");
  }
}

function clearMemoryCache() {
  memoryCache = new Map();
  return { ok: true };
}

function loadDiskCache() {
  try {
    const raw = JSON.parse(fs.readFileSync(cachePath(), "utf8"));
    if (raw?.v !== CACHE_VERSION || !raw?.entries || typeof raw.entries !== "object") return {};
    return raw.entries;
  } catch {
    return {};
  }
}

function saveDiskCache(entries) {
  try {
    const keys = Object.keys(entries);
    const trimmed = {};
    for (const k of keys.slice(-400)) trimmed[k] = entries[k];
    fs.writeFileSync(
      cachePath(),
      JSON.stringify({ v: CACHE_VERSION, entries: trimmed }, null, 0),
      "utf8"
    );
  } catch {
  }
}

function briefHash(brief) {
  const key = JSON.stringify({
    subject: brief.subject,
    context: brief.context,
    query: brief.query,
    mustInclude: brief.mustInclude,
    mustAvoid: brief.mustAvoid,
  });
  return crypto.createHash("sha1").update(key).digest("hex").slice(0, 24);
}

function asciiQuery(text) {
  return String(text || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s\-_.]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  return asciiQuery(text)
    .split(/[\s\-_,.]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

const STOP = new Set([
  "the", "and", "for", "with", "from", "this", "that", "into", "over", "under",
  "image", "photo", "picture", "illustration", "stock", "generic", "about",
  "using", "based", "related", "showing", "show", "very", "more", "than",
]);

function buildVisualBrief(imageValue, pageContext = {}) {
  const v = imageValue && typeof imageValue === "object" ? imageValue : {};
  const visual = v.visual && typeof v.visual === "object" ? v.visual : {};
  const topic = String(pageContext.topic || "").trim();
  const purpose = String(pageContext.purpose || "").trim();
  const pageTitle = String(pageContext.pageTitle || pageContext.title || "").trim();

  const subject = String(
    visual.subject || v.searchQuery || v.description || v.caption || topic || "education"
  ).trim();
  const context = String(
    visual.context || [topic, purpose, pageTitle].filter(Boolean).join(": ") || subject
  ).trim();
  const mustInclude = Array.isArray(visual.mustInclude)
    ? visual.mustInclude.map(String).filter(Boolean).slice(0, 6)
    : tokenize(subject).slice(0, 4);
  const mustAvoid = Array.isArray(visual.mustAvoid)
    ? visual.mustAvoid.map(String).filter(Boolean).slice(0, 6)
    : ["handshake", "generic office", "random crowd", "stock smile"];

  const queryParts = [
    asciiQuery(visual.searchQuery || v.searchQuery || ""),
    asciiQuery(subject),
    ...mustInclude.map(asciiQuery),
  ].filter(Boolean);

  let query = queryParts[0] || asciiQuery(topic) || "education textbook diagram";
  if (tokenize(query).length < 2) {
    const extra = tokenize(`${topic} ${purpose}`).slice(0, 3).join(" ");
    if (extra) query = `${query} ${extra}`.trim();
  }
  query = query.split(/\s+/).slice(0, 10).join(" ");

  return {
    subject,
    context,
    mustInclude,
    mustAvoid,
    query,
    caption: String(v.caption || visual.caption || subject).trim(),
    alt: String(v.alt || v.caption || subject).trim(),
  };
}

function queryVariants(brief) {
  const words = String(brief.query || "")
    .split(/\s+/)
    .filter(Boolean);
  const subjectWords = asciiQuery(brief.subject)
    .split(/\s+/)
    .filter(Boolean);
  const include = brief.mustInclude.map(asciiQuery).filter(Boolean);
  const stripped = words.filter(
    (w) => !/^(dark|mode|light|style|screenshot|photo|image|picture|realistic|ui)$/i.test(w)
  );
  const variants = [
    brief.query,
    words.slice(0, 5).join(" "),
    words.slice(0, 3).join(" "),
    stripped.slice(0, 4).join(" "),
    subjectWords.slice(0, 4).join(" "),
    include.slice(0, 3).join(" "),
    [...subjectWords.slice(0, 2), ...include.slice(0, 2)].filter(Boolean).join(" "),
  ]
    .map((q) => String(q || "").trim())
    .filter((q) => q.length >= 3);
  return [...new Set(variants)].slice(0, 6);
}

async function searchOpenverse(query, limit = 6) {
  const url =
    `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}` +
    `&page_size=${Math.min(20, limit)}&license=pdm,cc0,by,by-sa,by-nc,by-nd,by-nc-sa,by-nc-nd`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const rows = Array.isArray(data?.results) ? data.results : [];
  return rows
    .map((r) => ({
      url: r.url || r.thumbnail,
      thumb: r.thumbnail || r.url,
      title: r.title || "",
      creator: r.creator || "",
      source: "openverse",
      foreignLandingUrl: r.foreign_landing_url || r.detail_url || "",
      license: r.license || "",
      id: `ov:${r.id || r.url}`,
    }))
    .filter((c) => c.url && /^https?:\/\//i.test(c.url));
}

async function searchCommons(query, limit = 6) {
  const api =
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*" +
    "&generator=search&gsrnamespace=6&gsrlimit=" +
    Math.min(12, limit) +
    "&gsrsearch=" +
    encodeURIComponent(query) +
    "&prop=imageinfo|info&inprop=url&iiprop=url|mime|size|extmetadata&iiurlwidth=960";
  const res = await fetch(api, {
    headers: { Accept: "application/json", "User-Agent": UA },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const pages = Object.values(data?.query?.pages || {});
  const out = [];
  for (const page of pages) {
    const info = page?.imageinfo?.[0];
    if (!info) continue;
    const mime = String(info.mime || "");
    if (
      !mime.startsWith("image/") ||
      mime.includes("svg") ||
      mime.includes("djvu") ||
      mime.includes("tiff")
    ) {
      continue;
    }
    const url = info.thumburl || info.url;
    if (!url || !/^https?:\/\//i.test(url)) continue;
    const meta = info.extmetadata || {};
    out.push({
      url,
      thumb: info.thumburl || url,
      title: String(page.title || "").replace(/^File:/i, ""),
      creator: String(meta.Artist?.value || "")
        .replace(/<[^>]+>/g, "")
        .slice(0, 120),
      source: "wikimedia",
      foreignLandingUrl: page.canonicalurl || info.descriptionurl || "",
      license: String(meta.LicenseShortName?.value || meta.UsageTerms?.value || "").slice(0, 80),
      id: `wm:${page.pageid || url}`,
    });
  }
  return out;
}

function textRelevanceScore(candidate, brief) {
  const hay = tokenize(`${candidate.title} ${candidate.creator} ${candidate.url}`);
  const needle = new Set([
    ...tokenize(brief.subject),
    ...tokenize(brief.query),
    ...brief.mustInclude.flatMap(tokenize),
    ...tokenize(brief.context).slice(0, 8),
  ]);
  if (!needle.size) return 0.2;
  let hits = 0;
  for (const t of needle) {
    if (hay.includes(t)) hits += 1;
  }
  let score = hits / Math.max(3, Math.min(needle.size, 8));

  const avoid = brief.mustAvoid.map(asciiQuery).filter(Boolean);
  const titleLow = asciiQuery(candidate.title);
  for (const bad of avoid) {
    if (bad && titleLow.includes(bad)) score -= 0.25;
  }
  if (/logo|icon|svg|map icon|flag icon/i.test(candidate.title)) score -= 0.15;
  return Math.max(0, Math.min(1, score));
}

async function fetchImageAsInlinePart(imageUrl) {
  const res = await fetch(imageUrl, {
    headers: { "User-Agent": UA, Accept: "image/*,*/*" },
    redirect: "follow",
  });
  if (!res.ok) return null;
  const mime = String(res.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
  if (!mime.startsWith("image/") || mime.includes("svg")) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 800 || buf.length > 2_500_000) return null;
  return {
    inline_data: {
      mime_type: mime === "image/jpg" ? "image/jpeg" : mime,
      data: buf.toString("base64"),
    },
  };
}

async function visionScore(candidate, brief) {
  try {
    const inline = await fetchImageAsInlinePart(candidate.thumb || candidate.url);
    if (!inline) return null;
    const prompt =
      `Score how well this image matches the visual brief for an education document.\n` +
      `Return ONLY JSON: {"score":0.0-1.0,"reason":"short"}\n\n` +
      `Brief subject: ${brief.subject}\n` +
      `Context: ${brief.context}\n` +
      `Must include ideas: ${brief.mustInclude.join(", ") || "(none)"}\n` +
      `Must avoid: ${brief.mustAvoid.join(", ") || "(none)"}\n` +
      `Image title: ${candidate.title || "(unknown)"}\n` +
      `Rules: score <0.4 if off-topic, decorative-only, wrong subject, or misleading. ` +
      `score >=0.7 only if clearly useful for this brief.`;

    const res = await geminiGenerate({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }, inline],
        },
      ],
      systemInstruction: "You are a strict image relevance judge. Output JSON only.",
      temperature: 0.1,
      maxOutputTokens: 256,
      responseMimeType: "application/json",
    });
    if (!res.ok) return null;
    const text = String(res.text || "").trim();
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          parsed = JSON.parse(m[0]);
        } catch {
          parsed = null;
        }
      }
    }
    const score = Number(parsed?.score);
    if (!Number.isFinite(score)) return null;
    return {
      score: Math.max(0, Math.min(1, score)),
      reason: String(parsed?.reason || "").slice(0, 200),
    };
  } catch {
    return null;
  }
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function placeholderDataUrl(brief) {
  const title = String(brief.subject || brief.caption || "Illustration")
    .replace(/[<>&"]/g, "")
    .slice(0, 64);
  const sub = String(brief.context || "")
    .replace(/[<>&"]/g, "")
    .slice(0, 80);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">` +
    `<rect width="960" height="540" fill="#0f172a"/>` +
    `<rect x="48" y="48" width="864" height="444" rx="18" fill="#1e293b" stroke="#334155"/>` +
    `<text x="480" y="250" text-anchor="middle" fill="#e2e8f0" font-family="Segoe UI, Arial" font-size="28" font-weight="600">${escapeXml(title)}</text>` +
    `<text x="480" y="300" text-anchor="middle" fill="#94a3b8" font-family="Segoe UI, Arial" font-size="16">${escapeXml(sub)}</text>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function searchWikipediaThumb(query) {
  const title = String(query || "")
    .split(/\s+/)
    .slice(0, 6)
    .join(" ")
    .trim();
  if (!title) return [];
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json", "Api-User-Agent": UA, "User-Agent": UA },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const src = data?.originalimage?.source || data?.thumbnail?.source || "";
    if (!src || !/^https?:\/\//i.test(src)) return [];
    return [
      {
        url: src,
        thumb: data?.thumbnail?.source || src,
        title: data?.title || title,
        creator: "Wikipedia",
        source: "wikipedia",
        foreignLandingUrl: data?.content_urls?.desktop?.page || "",
        license: "wikipedia",
        id: `wp:${data?.pageid || title}`,
      },
    ];
  } catch {
    return [];
  }
}

async function collectCandidates(brief) {
  const variants = queryVariants(brief);
  const found = [];
  const seen = new Set();

  const pushAll = (rows) => {
    for (const c of rows || []) {
      if (!c?.url || seen.has(c.url)) continue;
      seen.add(c.url);
      found.push({ ...c, textScore: textRelevanceScore(c, brief) });
    }
  };

  for (const q of [brief.subject, variants[0], variants[1]].filter(Boolean).slice(0, 2)) {
    pushAll(await searchWikipediaThumb(q));
  }

  for (const q of variants) {
    const batches = await Promise.allSettled([searchOpenverse(q, 6), searchCommons(q, 6)]);
    for (const batch of batches) {
      if (batch.status !== "fulfilled") continue;
      pushAll(batch.value);
    }
    if (found.length >= MAX_CANDIDATES) break;
  }

  found.sort((a, b) => {
    const tie = (b.textScore || 0) - (a.textScore || 0);
    if (Math.abs(tie) > 0.05) return tie;
    if (a.source === "wikipedia" && b.source !== "wikipedia") return -1;
    if (b.source === "wikipedia" && a.source !== "wikipedia") return 1;
    return 0;
  });
  return found.slice(0, MAX_CANDIDATES);
}

async function resolveStudiedImage(imageValue, pageContext = {}) {
  const brief = buildVisualBrief(imageValue, pageContext);
  const hash = briefHash(brief);
  const fast = Boolean(pageContext.fast);

  if (memoryCache.has(hash)) return memoryCache.get(hash);
  const disk = loadDiskCache();
  if (disk[hash]?.url && disk[hash]?.imageMeta?.placeholder !== true) {
    memoryCache.set(hash, disk[hash]);
    return disk[hash];
  }

  let candidates = [];
  try {
    candidates = await collectCandidates(brief);
  } catch {
    candidates = [];
  }

  let chosen = null;
  const rejected = new Set();

  if (fast) {
    chosen =
      candidates.find((c) => c.textScore >= 0.45) ||
      candidates.find((c) => c.source === "wikipedia" && c.textScore >= 0.25) ||
      candidates[0] ||
      null;
  } else {
    for (const c of candidates.slice(0, MAX_VISION_CHECKS)) {
      const v = await visionScore(c, brief);
      if (!v) {
        continue;
      }
      c.visionScore = v.score;
      c.visionReason = v.reason;
      if (v.score >= VISION_MIN_SCORE) {
        chosen = c;
        break;
      }
      rejected.add(c.id);
    }

    if (!chosen) {
      chosen =
        candidates.find((c) => !rejected.has(c.id) && c.textScore >= 0.55) ||
        candidates.find(
          (c) => !rejected.has(c.id) && c.source === "wikipedia" && c.textScore >= 0.3
        ) ||
        null;
    }
  }

  let result;
  if (chosen?.url) {
    result = {
      url: chosen.url,
      caption: brief.caption,
      alt: brief.alt || brief.caption,
      searchQuery: brief.query,
      imageMeta: {
        source: chosen.source,
        title: chosen.title,
        creator: chosen.creator,
        license: chosen.license,
        pageUrl: chosen.foreignLandingUrl,
        textScore: chosen.textScore,
        visionScore: chosen.visionScore ?? null,
        query: brief.query,
        placeholder: false,
      },
    };
  } else {
    result = {
      url: placeholderDataUrl(brief),
      caption: brief.caption,
      alt: brief.alt || brief.caption,
      searchQuery: brief.query,
      imageMeta: {
        source: "placeholder",
        title: brief.subject,
        creator: "",
        license: "",
        pageUrl: "",
        textScore: 0,
        visionScore: null,
        query: brief.query,
        placeholder: true,
      },
    };
  }

  memoryCache.set(hash, result);
  if (!result.imageMeta.placeholder) {
    disk[hash] = result;
    saveDiskCache(disk);
  }
  return result;
}

async function enrichImageValue(value, pageContext = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const hasImageHint =
    value.searchQuery ||
    value.description ||
    value.caption ||
    value.visual ||
    value.type === "image";
  if (!hasImageHint && !value.url) return value;

  const next = { ...value };
  const existing = String(next.url || "").trim();
  if (/^https?:\/\//i.test(existing) || existing.startsWith("data:image/")) {
    return next;
  }

  const resolved = await resolveStudiedImage(next, pageContext);
  return {
    ...next,
    type: next.type || "image",
    url: resolved.url,
    caption: next.caption || resolved.caption,
    alt: next.alt || resolved.alt,
    searchQuery: next.searchQuery || resolved.searchQuery,
    imageMeta: resolved.imageMeta,
  };
}

async function enrichFillsImages(fills, pageContext = {}) {
  const list = Array.isArray(fills) ? fills : [];
  const out = [];
  for (const fill of list) {
    const type = String(fill?.type || "").toLowerCase();
    if (
      type === "image" ||
      fill?.searchQuery ||
      fill?.visual ||
      (fill?.caption && !fill?.items && !fill?.value)
    ) {
      out.push(await enrichImageValue({ ...fill, type: type || "image" }, pageContext));
    } else {
      out.push(fill);
    }
  }
  return out;
}

async function enrichPagesImages(pages, docContext = {}) {
  const list = Array.isArray(pages) ? pages : [];
  const fast = Boolean(docContext.fast);

  async function enrichOnePage(page) {
    const fillsByRole =
      page?.fillsByRole && typeof page.fillsByRole === "object" ? { ...page.fillsByRole } : {};
    const pageContext = {
      topic: docContext.topic || "",
      title: docContext.title || "",
      purpose: page?.purpose || "",
      fast,
      pageTitle:
        typeof fillsByRole.title === "string"
          ? fillsByRole.title
          : fillsByRole.title?.value || "",
    };
    const keys = Object.keys(fillsByRole);
    await Promise.all(
      keys.map(async (key) => {
        const val = fillsByRole[key];
        if (!(val && typeof val === "object" && !Array.isArray(val))) return;
        const looksImage =
          val.type === "image" ||
          val.searchQuery ||
          val.visual ||
          (val.caption && !val.items && val.value == null);
        const roleIsImage = /^(img|image|hero|photo|coverImage|illustration|feature|banner)$/i.test(
          key
        );
        if (looksImage || roleIsImage) {
          fillsByRole[key] = await enrichImageValue(
            { ...val, type: val.type || "image" },
            pageContext
          );
        }
      })
    );
    return { ...page, fillsByRole };
  }

  return Promise.all(list.map((page) => enrichOnePage(page)));
}

module.exports = {
  buildVisualBrief,
  resolveStudiedImage,
  enrichImageValue,
  enrichFillsImages,
  enrichPagesImages,
  clearMemoryCache,
};