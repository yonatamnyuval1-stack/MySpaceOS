(function () {
  let executeFn = null;
  let showToastFn = null;
  let unsubscribe = null;

  function runAction(action, data) {
    const act = String(action || "").trim();
    if (!act) return;

    if (act.toLowerCase() === "notify") {
      const count = data?.newEvents || 0;
      showToastFn?.(`Drift: ${count} new change(s) detected`, 6000);
      return;
    }

    if (executeFn) {
      executeFn(act).then((result) => {
        if (!result?.ok && result?.error) {
          showToastFn?.(result.error, 5500);
        } else if (result?.message && result.message.length < 120) {
          showToastFn?.(result.message, 4500);
        }
      });
    }
  }

  function handleDriftUpdate(data) {
    if (!data?.newEvents) return;

    const rules = window.MySpaceShellConfig?.getWhenRules?.() || [];
    const matched = rules.filter((r) => r.trigger === "drift(new)");
    if (!matched.length) {
      showToastFn?.(`Drift: ${data.newEvents} new change(s) detected`, 5000);
      return;
    }

    matched.forEach((rule) => runAction(rule.action, data));
  }

  function refresh() {
  }

  function init(options = {}) {
    executeFn = options.execute || null;
    showToastFn = options.showToast || null;

    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }

    if (window.mySpace?.onDriftScanUpdate) {
      unsubscribe = window.mySpace.onDriftScanUpdate(handleDriftUpdate);
    }
  }

  window.MySpaceShellWhen = { init, refresh, handleDriftUpdate };
})();