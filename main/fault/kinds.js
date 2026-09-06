const KINDS = {
  LOAD_FAILED: {
    id: "LOAD_FAILED",
    category: "data",
    severity: "error",
    title: "Data could not be loaded",
    noise: false,
  },
  SAVE_FAILED: {
    id: "SAVE_FAILED",
    category: "data",
    severity: "error",
    title: "Data could not be saved",
    noise: false,
  },
  DATA_CORRUPT: {
    id: "DATA_CORRUPT",
    category: "data",
    severity: "error",
    title: "Data file is corrupt",
    noise: false,
  },
  NETWORK: {
    id: "NETWORK",
    category: "network",
    severity: "error",
    title: "Network failure",
    noise: false,
  },
  PERMISSION: {
    id: "PERMISSION",
    category: "permission",
    severity: "error",
    title: "Permission denied",
    noise: false,
  },
  RUNTIME: {
    id: "RUNTIME",
    category: "runtime",
    severity: "error",
    title: "Runtime failure",
    noise: false,
  },
  PAGE_LOAD: {
    id: "PAGE_LOAD",
    category: "runtime",
    severity: "error",
    title: "Page failed to load",
    noise: false,
  },
  VALIDATION: {
    id: "VALIDATION",
    category: "validation",
    severity: "info",
    title: "Validation / soft failure",
    noise: true,
  },
  UNKNOWN: {
    id: "UNKNOWN",
    category: "unknown",
    severity: "warn",
    title: "Unrecognized failure",
    noise: false,
  },
};

const CODE_TO_KIND = {
  LOAD_FAILED: "LOAD_FAILED",
  SAVE_FAILED: "SAVE_FAILED",
  DATA_CORRUPT: "DATA_CORRUPT",
  NETWORK: "NETWORK",
  NETWORK_FAILED: "NETWORK",
  PERMISSION: "PERMISSION",
  PERMISSION_DENIED: "PERMISSION",
  RUNTIME: "RUNTIME",
  RUNTIME_FAILED: "RUNTIME",
  PAGE_LOAD: "PAGE_LOAD",
  DID_FAIL_LOAD: "PAGE_LOAD",
  RENDER_PROCESS_GONE: "PAGE_LOAD",
  CONTENTS_UNRESPONSIVE: "RUNTIME",
  UNCAUGHT_EXCEPTION: "RUNTIME",
  UNHANDLED_REJECTION: "RUNTIME",
  RENDERER_ERROR: "RUNTIME",
  RENDERER_REJECTION: "RUNTIME",
  IPC_THROW: "RUNTIME",
  IPC_FAILURE: "UNKNOWN",
  VALIDATION: "VALIDATION",
  MANUAL: "UNKNOWN",
  FAULT: "UNKNOWN",
  UNKNOWN: "UNKNOWN",
};

const SOURCE_TO_KIND = {
  "process.uncaughtException": "RUNTIME",
  "process.unhandledRejection": "RUNTIME",
  "renderer.error": "RUNTIME",
  "renderer.unhandledrejection": "RUNTIME",
  "contents.render-process-gone": "PAGE_LOAD",
  "contents.did-fail-load": "PAGE_LOAD",
  "contents.unresponsive": "RUNTIME",
  "ipc.throw": "RUNTIME",
};

function blobOf(event = {}) {
  return [
    event.code,
    event.message,
    event.error,
    event.type,
    event.source,
    event.channel,
    event.stack,
    event.kind,
  ]
    .filter(Boolean)
    .join(" ");
}

function detectKind(event = {}) {
  if (event.kind && KINDS[event.kind]) return event.kind;

  const code = String(event.code || "").trim().toUpperCase();
  if (code && CODE_TO_KIND[code]) return CODE_TO_KIND[code];

  const source = String(event.source || "");
  if (SOURCE_TO_KIND[source]) return SOURCE_TO_KIND[source];

  const blob = blobOf(event);
  const ctx = event.context && typeof event.context === "object" ? event.context : {};

  if (ctx.corrupt || /\bcorrupt\b/i.test(blob) || /\bDATA_CORRUPT\b/i.test(blob)) {
    return "DATA_CORRUPT";
  }
  if (
    /\bLOAD_FAILED\b/i.test(blob) ||
    /\b(failed|could not|unable) to load\b/i.test(blob) ||
    /\bcould not load app data\b/i.test(blob)
  ) {
    return "LOAD_FAILED";
  }
  if (
    /\bSAVE_FAILED\b/i.test(blob) ||
    /\b(failed|could not|unable) to save\b/i.test(blob) ||
    /\bcould not save app data\b/i.test(blob) ||
    /\b(failed|could not|unable) to write\b/i.test(blob)
  ) {
    return "SAVE_FAILED";
  }
  if (
    /\bpermission\b|\bdenied\b|\bEACCES\b|\bEPERM\b|\bforbidden\b/i.test(blob)
  ) {
    return "PERMISSION";
  }
  if (
    /\bnetwork\b|\bfetch\b|\boffline\b|\bECONN\b|\bETIMEDOUT\b|\bENETUNREACH\b|\bEAI_AGAIN\b|\bnet::ERR_/i.test(
      blob
    ) ||
    /\bHTTP\s?[45]\d\d\b/i.test(blob) ||
    /\b(failed|could not|unable) to (connect|fetch)\b/i.test(blob)
  ) {
    return "NETWORK";
  }
  if (
    /\brender[- ]?process[- ]?gone\b|\bdid[- ]?fail[- ]?load\b|\bnet::ERR_/i.test(blob)
  ) {
    return "PAGE_LOAD";
  }
  if (
    /\buncaught\b|\bunhandled\b|\bTypeError\b|\bReferenceError\b|\bRangeError\b|\bSyntaxError\b|\bcrash\b|\bout of memory\b|\bIPC_THROW\b/i.test(
      blob
    ) ||
    source === "ipc.throw"
  ) {
    return "RUNTIME";
  }

  if (
    /\brequired\b|\binvalid\b|\bunknown (channel|action|verb|module)\b|\balready exists\b|\b(cancelled|canceled|aborted)\b|\bnot found\b|\bno handler\b|\bnothing to\b|\bempty (query|search)\b/i.test(
      blob
    )
  ) {
    return "VALIDATION";
  }

  if (source === "ipc.result") {
    if (/\b(failed|corrupt|exception|crash|timeout|denied|unable to|could not)\b/i.test(blob)) {
      return "UNKNOWN";
    }
    return "VALIDATION";
  }

  return "UNKNOWN";
}

function getKind(id) {
  return KINDS[id] || KINDS.UNKNOWN;
}

function listKinds() {
  return Object.values(KINDS);
}

module.exports = {
  KINDS,
  CODE_TO_KIND,
  SOURCE_TO_KIND,
  detectKind,
  getKind,
  listKinds,
  blobOf,
};