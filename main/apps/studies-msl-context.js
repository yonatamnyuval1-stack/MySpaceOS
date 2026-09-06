const { gatherMslAiContext } = require("../msl/ai-context");

async function gatherStudiesMslContext() {
  return gatherMslAiContext("studies", { label: "Studies" });
}

module.exports = { gatherStudiesMslContext };