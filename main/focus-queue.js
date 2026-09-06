const { focusExternalApp } = require("./focus-window");

let chain = Promise.resolve();

function queueFocusExternalApp(exePath) {
  const job = chain.then(() => focusExternalApp(exePath));
  chain = job.catch(() => {});
  return job;
}

module.exports = { queueFocusExternalApp };