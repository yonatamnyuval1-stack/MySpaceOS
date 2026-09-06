const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ICONS_DIR = path.join(ROOT, "node_modules", "lucide-static", "icons");
const OUT = path.join(ROOT, "apps", "icon-library", "icons-data.js");

const PACK_RULES = [
  {
    id: "system",
    words: [
      "home", "settings", "search", "menu", "user", "users", "bell", "lock", "unlock", "eye",
      "power", "wifi", "bluetooth", "battery", "monitor", "smartphone", "laptop", "globe",
      "map-pin", "clock", "calendar", "sun", "moon", "info", "help", "alert", "shield",
      "key", "fingerprint", "scan-face", "accessibility", "languages", "earth", "navigation",
      "compass", "locate", "map", "route", "signpost", "landmark", "building", "house",
      "castle", "church", "hospital", "school", "university", "factory", "warehouse",
      "door", "sofa", "bed", "lamp", "plug", "unplug", "cpu", "memory-stick", "hard-drive",
      "router", "antenna", "radio", "satellite", "watch", "timer", "hourglass", "alarm",
      "toggle", "sliders", "gauge", "activity", "heartbeat", "life-buoy", "accessibility",
    ],
  },
  {
    id: "actions",
    words: [
      "plus", "minus", "x", "check", "edit", "trash", "copy", "clipboard", "download",
      "upload", "share", "link", "external", "refresh", "rotate", "filter", "zoom",
      "maximize", "minimize", "arrow", "chevron", "move", "grab", "hand", "pointer",
      "mouse", "redo", "undo", "replace", "scissors", "stamp", "bookmark", "pin",
      "star", "heart", "thumbs", "flag", "bookmark", "save", "import", "export",
      "log-in", "log-out", "log-in", "door-open", "door-closed", "fullscreen",
      "shrink", "expand", "fold", "unfold", "more", "ellipsis", "grip", "list-filter",
      "sort", "shuffle", "repeat", "rewind", "fast-forward", "skip", "play", "pause",
      "square", "circle-stop", "ban", "circle-x", "circle-check", "circle-plus",
      "circle-minus", "octagon", "triangle-alert",
    ],
  },
  {
    id: "files",
    words: [
      "file", "folder", "image", "images", "archive", "paperclip", "printer", "scan",
      "database", "hard-drive", "book", "notebook", "library", "scroll", "sheet",
      "table", "kanban", "clipboard", "sticky-note", "notepad", "receipt", "invoice",
      "presentation", "contact", "id-card", "badge", "ticket", "gift", "package",
      "box", "boxes", "container", "briefcase", "backpack", "suitcase", "wallet",
    ],
  },
  {
    id: "media",
    words: [
      "play", "pause", "skip", "volume", "mic", "camera", "video", "music",
      "headphones", "film", "clapperboard", "speaker", "audio", "podcast", "radio",
      "tv", "aperture", "focus", "flashlight", "disc", "album", "guitar", "piano",
      "drum", "microscope", "telescope", "binoculars",
    ],
  },
  {
    id: "comms",
    words: [
      "mail", "message", "phone", "send", "at-sign", "hash", "rss", "inbox",
      "voicemail", "megaphone", "newspaper", "speech", "messages-square", "reply",
      "forward", "bell-ring", "bell-off", "smartphone", "tablet", "webcam",
    ],
  },
  {
    id: "commerce",
    words: [
      "shopping", "credit-card", "wallet", "dollar", "euro", "pound", "yen", "bitcoin",
      "percent", "tag", "tags", "receipt", "trending", "chart", "pie-chart", "bar-chart",
      "candlestick", "banknote", "coins", "hand-coins", "badge-dollar", "badge-percent",
      "store", "storefront", "truck", "plane", "ship", "train", "bus", "car", "bike",
      "fuel", "parking", "ticket", "coupon", "scale", "weight", "calculator",
    ],
  },
  {
    id: "dev",
    words: [
      "code", "terminal", "bug", "git", "package", "server", "cloud", "braces",
      "binary", "bot", "sparkles", "wand", "cpu", "circuit", "brackets", "parentheses",
      "regex", "variable", "function", "component", "blocks", "puzzle", "workflow",
      "git-branch", "git-commit", "git-merge", "git-pull", "git-fork", "github",
      "gitlab", "docker", "container", "network", "webhook", "api", "json", "xml",
      "html", "css", "javascript", "typescript", "python", "ruby", "rust", "swift",
      "database", "table", "rows", "columns", "square-terminal", "square-code",
      "file-code", "file-json", "file-type", "inspect", "bug-off", "radar",
    ],
  },
  {
    id: "nature",
    words: [
      "leaf", "flame", "droplet", "mountain", "trees", "tree", "flower", "fish",
      "bird", "cat", "dog", "rabbit", "snail", "bug", "worm", "paw", "bone",
      "sprout", "shrub", "wheat", "apple", "banana", "cherry", "grape", "citrus",
      "carrot", "egg", "milk", "coffee", "beer", "wine", "utensils", "chef",
      "cloud-sun", "cloud-moon", "cloud-rain", "cloud-snow", "cloud-lightning",
      "snowflake", "wind", "tornado", "waves", "sailboat", "anchor", "shell",
    ],
  },
  {
    id: "shapes",
    words: [
      "circle", "triangle", "hexagon", "octagon", "diamond", "box", "layers",
      "grid", "layout", "palette", "pen-tool", "type", "a-large", "brush",
      "paintbrush", "paint-bucket", "pipette", "crop", "frame", "squircle",
      "cylinder", "cone", "pyramid", "cuboid", "radius", "spline", "vector",
      "bezier", "pencil", "eraser", "highlighter", "marker", "ruler", "drafting",
    ],
  },
];

function titleCase(id) {
  return id
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function pickPack(id) {
  for (const rule of PACK_RULES) {
    for (const w of rule.words) {
      if (id === w || id.startsWith(w + "-") || id.endsWith("-" + w) || id.includes("-" + w + "-")) {
        return rule.id;
      }
    }
  }
  return "system";
}

function extractInner(svg) {
  const m = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  if (!m) return "";
  return m[1]
    .replace(/\s+/g, " ")
    .replace(/> </g, "><")
    .trim();
}

function tagsFromId(id) {
  const parts = id.split("-").filter(Boolean);
  return [...new Set(parts)].slice(0, 6);
}

const files = fs
  .readdirSync(ICONS_DIR)
  .filter((f) => f.endsWith(".svg"))
  .sort((a, b) => a.localeCompare(b));

const icons = [];
for (const file of files) {
  const id = file.replace(/\.svg$/i, "");
  const raw = fs.readFileSync(path.join(ICONS_DIR, file), "utf8");
  const paths = extractInner(raw);
  if (!paths) continue;
  if (paths.length > 4000) continue;
  icons.push({
    id,
    name: titleCase(id),
    pack: pickPack(id),
    tags: tagsFromId(id),
    paths,
  });
}

const packs = [
  { id: "all", label: "All" },
  { id: "system", label: "System" },
  { id: "actions", label: "Actions" },
  { id: "files", label: "Files" },
  { id: "media", label: "Media" },
  { id: "comms", label: "Comms" },
  { id: "commerce", label: "Commerce" },
  { id: "dev", label: "Dev" },
  { id: "nature", label: "Nature" },
  { id: "shapes", label: "Shapes" },
];

const counts = {};
for (const i of icons) counts[i.pack] = (counts[i.pack] || 0) + 1;

const payload = JSON.stringify(icons);
const js = `/**
 * Built-in icon catalog: Lucide icons (ISC), viewBox 0 0 24 24 stroke SVG.
 * Generated by scripts/build-icon-library.js: do not hand-edit the ICONS array.
 * ${icons.length} icons. Attribution: https://lucide.dev (ISC License)
 */
(function (root) {
  const PACKS = ${JSON.stringify(packs, null, 2)};

  /** @type {{id:string,name:string,pack:string,tags:string[],paths:string}[]} */
  const ICONS = ${payload};

  function toSvg(icon, opts) {
    opts = opts || {};
    const size = Number(opts.size) || 24;
    const stroke = Number(opts.strokeWidth) || 2;
    const color = opts.color || "currentColor";
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="' + stroke + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icon.paths + "</svg>";
  }

  function getById(id) {
    return ICONS.find(function (i) { return i.id === id; }) || null;
  }

  function search(query, packId) {
    const q = String(query || "").trim().toLowerCase();
    return ICONS.filter(function (icon) {
      if (packId && packId !== "all" && icon.pack !== packId) return false;
      if (!q) return true;
      const hay = [icon.id, icon.name, icon.pack].concat(icon.tags || []).join(" ").toLowerCase();
      return hay.indexOf(q) !== -1;
    });
  }

  root.IconLibraryData = {
    PACKS: PACKS,
    ICONS: ICONS,
    toSvg: toSvg,
    getById: getById,
    search: search,
    count: ICONS.length,
    ATTRIBUTION: "Icons from Lucide (ISC License) — https://lucide.dev",
  };
})(typeof window !== "undefined" ? window : globalThis);
`;

fs.writeFileSync(OUT, js);
console.log({
  out: OUT,
  icons: icons.length,
  bytes: js.length,
  packs: counts,
});