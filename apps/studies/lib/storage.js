(function (root) {
  let cache = null;

  async function load() {
    if (!window.myApp) return { subjects: [], documents: [], settings: {} };
    const res = await window.myApp.invoke("storage.load", {});
    if (res?.ok && res.data) {
      cache = res.data;
      return cache;
    }
    return { subjects: [], documents: [], settings: {} };
  }

  async function save(data) {
    cache = data;
    if (!window.myApp) return;
    await window.myApp.invoke("storage.save", { data });
  }

  async function getData() {
    return cache || (await load());
  }

  async function getDocuments() {
    const data = await getData();
    return data.documents || [];
  }

  async function getDocument(id) {
    const docs = await getDocuments();
    return docs.find((d) => d.id === id) || null;
  }

  async function getSettings() {
    const data = await getData();
    return data.settings || { autoSaveMs: 1500, fontSize: 16, lineHeight: 1.65 };
  }

  async function saveDocument(doc) {
    const data = await getData();
    const docs = data.documents || [];
    const idx = docs.findIndex((d) => d.id === doc.id);
    if (idx >= 0) docs[idx] = doc;
    else docs.unshift(doc);
    data.documents = docs;
    await save(data);
    return doc;
  }

  async function createDocument({ title, content, template, tags, docMode, formalStyle } = {}) {
    const { uid } = root.StudiesUtils;
    const styleId = root.StudiesFormal?.getStyle?.(formalStyle)?.id || "academic";
    const doc = {
      id: uid("doc"),
      title: title || "Untitled document",
      content: content || "<p><br></p>",
      template: template || "blank",
      docMode: docMode === "formal" ? "formal" : "visual",
      formalStyle: styleId,
      pinned: false,
      tags: Array.isArray(tags) ? tags : [],
      slots: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveDocument(doc);
    return doc;
  }

  async function deleteDocument(id) {
    const data = await getData();
    data.documents = (data.documents || []).filter((d) => d.id !== id);
    await save(data);
  }

  async function exportFile(filename, content) {
    if (!window.myApp) return { ok: false };
    return window.myApp.invoke("export.file", { filename, content });
  }

  async function exportPdf(filename, html) {
    if (!window.myApp) return { ok: false };
    return window.myApp.invoke("export.pdf", { filename, html });
  }

  async function exportDocx(filename, base64) {
    if (!window.myApp) return { ok: false };
    return window.myApp.invoke("export.docx", { filename, base64 });
  }

  root.StudiesStorage = {
    load,
    save,
    getData,
    getDocuments,
    getDocument,
    getSettings,
    saveDocument,
    createDocument,
    deleteDocument,
    exportFile,
    exportPdf,
    exportDocx,
  };
})(window);