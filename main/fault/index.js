const installMod = require("./install");
const observeMod = require("./observe");
const wrapMod = require("./wrap");
const classifyMod = require("./classify");

module.exports = {
  install: installMod.install,
  observe: observeMod.observe,
  observeError: observeMod.observeError,
  observeIpcResult: wrapMod.observeIpcResult,
  runObserved: wrapMod.runObserved,
  classify: classifyMod.classify,
  detectKind: require("./kinds").detectKind,
  listKinds: require("./kinds").listKinds,
  KINDS: require("./kinds").KINDS,
};