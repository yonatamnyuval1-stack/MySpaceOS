const { detectKind, getKind, blobOf, KINDS } = require("./kinds");

const HARD_MARKERS = [
  /\bcorrupt\b/i,
  /\bEACCES\b|\bEPERM\b|\bENOSPC\b|\bECONN\b|\bETIMEDOUT\b/i,
  /\b(failed|could not|unable) to (load|save|write|read|parse|connect|fetch)\b/i,
  /\buncaught\b|\bunhandled\b|\bTypeError\b|\bReferenceError\b|\bSyntaxError\b/i,
  /\bcrash\b|\brender[- ]?process[- ]?gone\b|\bnet::ERR_/i,
  /\bLOAD_FAILED\b|\bSAVE_FAILED\b|\bDATA_CORRUPT\b|\bRUNTIME\b/i,
];

function isNoise(event = {}, kindId) {
  if (event.noise === true) return true;
  if (event.force === true || (event.severity === "error" && event.forceNotify)) return false;

  const kind = getKind(kindId || detectKind(event));
  if (kind.noise) return true;

  const source = String(event.source || "");
  if (
    source.startsWith("process.") ||
    source.startsWith("contents.") ||
    source.startsWith("renderer.") ||
    source === "ipc.throw"
  ) {
    return false;
  }

  const blob = blobOf(event);
  if (HARD_MARKERS.some((re) => re.test(blob))) return false;

  return kind.id === "VALIDATION";
}

/**
 * @returns {{ kind: string, code: string, category: string, severity: string, noise: boolean, alert: boolean, message: string, title: string }}
 */
function classify(event = {}) {
  const kindId = detectKind(event);
  const kind = getKind(kindId);
  const noise = isNoise(event, kindId);
  const explicit = event.code ? String(event.code).trim() : "";
  const code = kindId;

  let severity = kind.severity;
  if (event.severity && ["info", "warn", "error"].includes(event.severity)) {
    severity = event.severity;
  } else if (noise) {
    severity = "info";
  }

  const message = String(event.message || event.error || kind.title).trim() || kind.title;
  const category = event.category || kind.category;
  const alert = !noise && severity === "error";

  return {
    kind: kindId,
    code,
    category,
    severity,
    noise,
    alert,
    message,
    title: kind.title,
    explicitCode: explicit || undefined,
  };
}

module.exports = {
  classify,
  isNoise,
  detectKind,
  getKind,
  listKinds: () => Object.values(KINDS),
  KINDS,
  HARD_RE: HARD_MARKERS,
  NOISE_RE: [],
};