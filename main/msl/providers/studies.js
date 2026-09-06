const { handleStudiesInvoke } = require("../../apps/studies-ipc");

function slimDoc(d) {
  if (!d) return null;
  return {
    id: d.id,
    title: d.title || "Untitled",
    subjectId: d.subjectId || null,
    docMode: d.docMode || "visual",
    formalStyle: d.formalStyle || null,
    updatedAt: d.updatedAt || null,
    createdAt: d.createdAt || null,
  };
}

async function listDocs(input = {}) {
  const res = await handleStudiesInvoke("storage.load", {});
  if (!res?.ok) return res;
  let documents = (res.data?.documents || []).map(slimDoc).filter(Boolean);
  const q = String(input.q || input.query || "").trim().toLowerCase();
  if (q) {
    documents = documents.filter((d) => [d.title, d.docMode, d.formalStyle].join(" ").toLowerCase().includes(q));
  }
  if (input.docMode) {
    documents = documents.filter((d) => d.docMode === input.docMode);
  }
  const limit = Math.min(Math.max(Number(input.limit) || 60, 1), 200);
  return { ok: true, documents: documents.slice(0, limit), total: documents.length };
}

async function getDoc(input = {}) {
  const id = String(input.id || "").trim();
  if (!id) return { ok: false, error: "Missing document id" };
  const res = await handleStudiesInvoke("storage.load", {});
  if (!res?.ok) return res;
  const doc = (res.data?.documents || []).find((d) => d.id === id);
  if (!doc) return { ok: false, error: `Document not found: ${id}` };
  return { ok: true, document: doc };
}

async function exportPdf(input = {}) {
  const html = input.html || input.content;
  if (!html) return { ok: false, error: "Missing html/content" };
  return handleStudiesInvoke("export.pdf", {
    filename: input.filename,
    html,
    content: input.content,
  });
}

async function exportDocx(input = {}) {
  const html = input.html || input.content;
  if (!html) return { ok: false, error: "Missing html/content" };
  return handleStudiesInvoke("export.docx", {
    filename: input.filename,
    html,
    content: input.content,
  });
}

const CAPABILITIES = [
  {
    id: "studies.docs.list",
    kind: "query",
    provider: "studies",
    title: "List study documents",
    description: "Documents from Studies (titles/metadata)",
    handler: listDocs,
  },
  {
    id: "studies.docs.get",
    kind: "query",
    provider: "studies",
    title: "Get study document",
    description: "Full document payload by id",
    handler: getDoc,
  },
  {
    id: "studies.export.pdf",
    kind: "action",
    provider: "studies",
    title: "Export PDF",
    description: "Export HTML content to a PDF file via Studies",
    handler: exportPdf,
  },
  {
    id: "studies.export.docx",
    kind: "action",
    provider: "studies",
    title: "Export DOCX",
    description: "Export HTML content to a Word DOCX via Studies",
    handler: exportDocx,
  },
];

module.exports = { CAPABILITIES };
