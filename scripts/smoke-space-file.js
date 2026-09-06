const assert = require("assert");
const {
  parseDocument,
  buildDocument,
  looksLikeSpacePath,
  sanitizeFileStem,
} = require("../main/space-file-format");

const built = buildDocument({
  kind: "script",
  title: "morning",
  payload: { name: "morning", body: "today(list)\n" },
});
assert.ok(built.ok, built.error);
const parsed = parseDocument(built.text);
assert.ok(parsed.ok, parsed.error);
assert.equal(parsed.doc.kind, "script");
assert.equal(parsed.doc.payload.name, "morning");
assert.equal(parsed.doc.format, "myspace.space");

const secretFlow = buildDocument({
  kind: "flow",
  payload: {
    title: "Test",
    steps: [{ tool: "notify", label: "N", config: { message: "hi", apiKey: "SECRET" } }],
  },
});
assert.ok(secretFlow.ok, secretFlow.error);
assert.strictEqual(secretFlow.doc.payload.steps[0].config.apiKey, undefined);
assert.equal(secretFlow.doc.payload.steps[0].config.message, "hi");

assert.equal(parseDocument('{"no":true}').ok, false);
assert.equal(parseDocument("{").ok, false);
assert.ok(looksLikeSpacePath("C:\\\\a\\\\b.space"));
assert.equal(looksLikeSpacePath("notes.json"), false);
assert.equal(sanitizeFileStem('bad<>:"name'), "bad----name");

console.log("space-file format ok");
