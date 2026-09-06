function fillTemplate(text, fieldValues, { blankOptional = false } = {}) {
  return String(text ?? "").replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = fieldValues?.[key];
    if (v == null || v === "") return blankOptional ? "" : "________________________";
    return String(v);
  });
}

function isClauseBodyEmpty(body) {
  const t = String(body ?? "")
    .trim()
    .replace(/_{3,}/g, "")
    .replace(/\s+/g, " ");
  return !t;
}

function renderClauses(clauses, fieldValues) {
  return (Array.isArray(clauses) ? clauses : [])
    .map((c) => ({
      ...c,
      body: fillTemplate(c.body, fieldValues, { blankOptional: Boolean(c.optional) }),
    }))
    .filter((c) => !c.optional || !isClauseBodyEmpty(c.body));
}

const api = { fillTemplate, isClauseBodyEmpty, renderClauses };
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.PartsTplMustache = api;
