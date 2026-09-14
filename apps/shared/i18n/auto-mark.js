(function (root) {
  "use strict";

  const TEXT_PHRASES = [
    ["Refresh", "service.common.refresh"],
    ["About", "service.common.about"],
    ["Save", "service.common.save"],
    ["Cancel", "service.common.cancel"],
    ["Close", "service.common.close"],
    ["Open", "service.common.open"],
    ["Clear", "service.common.clear"],
    ["Delete", "service.common.delete"],
    ["Add", "service.common.add"],
    ["New", "service.common.new"],
    ["History", "service.common.history"],
    ["All", "service.common.all"],
    ["Filter", "service.common.filter"],
    ["Loading…", "service.common.loading"],
    ["Loading...", "service.common.loading"],
    ["Enabled", "service.common.enabled"],
    ["Disabled", "service.common.disabled"],
    ["Back", "service.common.back"],
    ["Edit", "service.common.edit"],
    ["Run", "service.common.run"],
    ["Stop", "service.common.stop"],
    ["Apply", "service.common.apply"],
    ["Skip", "service.common.skip"],
    ["Export", "service.common.export"],
    ["Import", "service.common.import"],
    ["Copy", "service.common.copy"],
    ["Rename", "service.common.rename"],
    ["Reveal", "service.common.reveal"],
    ["Status", "service.common.status"],
    ["Settings", "service.common.settings"],
    ["Done", "service.common.done"],
    ["Active", "service.common.active"],
    ["Pending", "service.common.pending"],
    ["Error", "service.common.error"],
    ["OK", "service.common.ok"],
    ["Reset", "service.common.reset"],
    ["Duplicate", "service.common.duplicate"],
    ["None", "service.common.none"],
    ["Default", "service.common.default"],
    ["Primary", "service.common.primary"],
    ["Secondary", "service.common.secondary"],
    ["Ghost", "service.common.ghost"],
    ["Apps", "shell.welcome.apps"],
    ["Services", "shell.welcome.services"],
    ["Notifications", "shell.notifications.pageTitle"],
    ["Mark all read", "shell.notifications.markAllRead"],
    ["Clear all", "shell.notifications.clearAll"],
    ["No notifications", "shell.notifications.empty"],
    ["Queue", "service.jobs.queue"],
    ["Enqueue", "service.jobs.enqueue"],
    ["Capacity", "service.jobs.capacity"],
    ["Clear finished", "service.jobs.clear"],
    ["Places", "service.files.places"],
    ["Drives", "service.files.drives"],
    ["Favorites", "service.files.favorites"],
    ["Recent", "service.files.recent"],
    ["Explorer", "service.files.explorer"],
    ["Name", "service.files.name"],
    ["Modified", "service.files.modified"],
    ["Size", "service.files.size"],
    ["Overview", "service.permissions.overview"],
    ["AI tools", "service.permissions.tools"],
    ["External", "service.permissions.external"],
    ["Devices", "service.bridge.devices"],
    ["Share", "service.bridge.share"],
    ["Host", "service.bridge.host"],
    ["Inbox", "service.resolve.inbox"],
    ["Playbooks", "service.resolve.playbooks"],
    ["Capabilities", "service.msl.capabilities"],
    ["Keys", "service.msl.keys"],
    ["Mint", "service.msl.mint"],
    ["Inject", "service.msl.inject"],
    ["Explore", "service.parts.explore"],
    ["Publish", "service.parts.publish"],
    ["Current", "service.updates.current"],
    ["Adapters", "service.network.adapters"],
    ["Ports", "service.network.ports"],
    ["Cleanup", "service.storage.cleanup"],
    ["Large files", "service.storage.largeFiles"],
    ["Catalog", "service.info.catalog"],
    ["Ask", "service.mind.ask"],
    ["Setup", "service.mind.setup"],
    ["Send", "service.mind.send"],
  ];

  const TITLE_PHRASES = [
    ["Refresh", "service.common.refresh"],
    ["Settings", "service.common.settings"],
    ["Back", "service.common.back"],
    ["Close", "service.common.close"],
    ["Open", "service.common.open"],
    ["Delete", "service.common.delete"],
    ["Notification settings", "shell.notifications.settingsAria"],
    ["Close settings", "shell.notifications.closeSettings"],
    ["Add favorite folder", "service.files.addFav"],
    ["Clear recent", "service.files.clearRecent"],
    ["New folder", "service.files.newFolder"],
    ["Open in Explorer", "service.files.openExplorer"],
    ["Sort", "service.files.sort"],
  ];

  const PLACEHOLDER_PHRASES = [
    ["Search…", "service.common.search"],
    ["Search...", "service.common.search"],
    ["Search apps…", "shell.start.search"],
    ["Search apps...", "shell.start.search"],
    ["Search everything in My Space…", "shell.palette.placeholder"],
    ["Search everything in My Space...", "shell.palette.placeholder"],
    ["Go to path…", "service.files.goto"],
    ["Go to path...", "service.files.goto"],
    ["Filter in folder…", "service.files.filter"],
    ["Filter in folder...", "service.files.filter"],
    ["Filter jobs…", "service.jobs.filterJobs"],
    ["Filter jobs...", "service.jobs.filterJobs"],
    ["Filter…", "service.jobs.filter"],
    ["Filter...", "service.jobs.filter"],
    ["Filter schedules…", "service.scheduler.filter"],
    ["Filter schedules...", "service.scheduler.filter"],
    ["Filter tools…", "service.permissions.filterTools"],
    ["Filter tools...", "service.permissions.filterTools"],
    ["What do you need?", "service.mind.placeholder"],
    ["Paste key…", "service.mind.pasteKey"],
    ["Paste key...", "service.mind.pasteKey"],
    ["sender@example.com", "shell.notifications.blockPlaceholder"],
    ["Script name", "service.scripts.namePlaceholder"],
  ];

  const ARIA_PHRASES = [
    ["Close", "service.common.close"],
    ["Back", "service.common.back"],
    ["Settings", "service.common.settings"],
    ["Notification settings", "shell.notifications.settingsAria"],
    ["Close settings", "shell.notifications.closeSettings"],
    ["Command palette", "shell.palette.aria"],
    ["Start menu", "shell.start.aria"],
    ["Mind", "service.mind.title"],
    ["Places", "service.files.places"],
    ["Drives", "service.files.drives"],
    ["Favorites", "service.files.favorites"],
    ["Recent", "service.files.recent"],
  ];

  function phraseMap(rows) {
    const map = new Map();
    for (const [phrase, key] of rows) map.set(phrase, key);
    return map;
  }

  const textMap = phraseMap(TEXT_PHRASES);
  const titleMap = phraseMap(TITLE_PHRASES);
  const placeholderMap = phraseMap(PLACEHOLDER_PHRASES);
  const ariaMap = phraseMap(ARIA_PHRASES);
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"]);
  const HEB = /[\u0590-\u05FF]/;

  function isElementLeaf(el) {
    if (!el || el.nodeType !== 1) return false;
    if (SKIP_TAGS.has(el.tagName)) return false;
    for (let i = 0; i < el.childNodes.length; i++) {
      if (el.childNodes[i].nodeType === 1) return false;
    }
    return true;
  }

  function markTextLeaves(rootEl) {
    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        if (SKIP_TAGS.has(node.tagName)) return NodeFilter.FILTER_REJECT;
        if (node.hasAttribute?.("data-i18n")) return NodeFilter.FILTER_REJECT;
        if (!isElementLeaf(node)) return NodeFilter.FILTER_SKIP;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const hits = [];
    let node;
    while ((node = walker.nextNode())) hits.push(node);
    for (const el of hits) {
      const raw = (el.textContent || "").trim();
      if (!raw || HEB.test(raw)) continue;
      const key = textMap.get(raw);
      if (!key) continue;
      el.setAttribute("data-i18n", key);
    }
  }

  function markAttr(rootEl, attr, dataAttr, map) {
    const all = rootEl.querySelectorAll ? rootEl.querySelectorAll(`[${attr}]`) : [];
    all.forEach((el) => {
      if (el.hasAttribute(dataAttr)) return;
      const raw = (el.getAttribute(attr) || "").trim();
      if (!raw || HEB.test(raw)) return;
      const key = map.get(raw);
      if (!key) return;
      el.setAttribute(dataAttr, key);
    });
  }

  function markOnly(rootEl) {
    const scope = rootEl || document;
    const rootNode = scope.documentElement || scope;
    if (!rootNode?.querySelectorAll) return;
    markTextLeaves(rootNode);
    markAttr(rootNode, "title", "data-i18n-title", titleMap);
    markAttr(rootNode, "placeholder", "data-i18n-placeholder", placeholderMap);
    markAttr(rootNode, "aria-label", "data-i18n-aria", ariaMap);
  }

  function apply() {
    if (typeof document === "undefined") return;
    markOnly(document);
    root.MySpaceI18n?.applyDom?.(document);
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", apply, { once: true });
    } else {
      apply();
    }
    document.addEventListener("myspace-i18n-applied", () => {
      markOnly(document);
      root.MySpaceI18n?.applyDom?.(document);
    });
    document.addEventListener("myspace-i18n-ready", () => {
      markOnly(document);
      root.MySpaceI18n?.applyDom?.(document);
    });
  }
})(typeof globalThis !== "undefined" ? globalThis : window);