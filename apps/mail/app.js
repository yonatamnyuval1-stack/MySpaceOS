(function () {
  function tt(key, vars) {
    return window.MySpaceI18n?.t?.(key, vars) ?? key;
  }

  const FOLDER_I18N = {
    INBOX: "service.mail.folder.inbox",
    STARRED: "service.mail.folder.starred",
    IMPORTANT: "service.mail.folder.important",
    SENT: "service.mail.folder.sent",
    DRAFT: "service.mail.folder.drafts",
    SPAM: "service.mail.folder.spam",
    TRASH: "service.mail.folder.trash",
    __ALL__: "service.mail.folder.allMail",
  };

  function folderDisplayName(label) {
    const key = FOLDER_I18N[label?.id];
    return key ? tt(key) : label.displayName || label.name || label.id || "";
  }

  const api = window.mailApi;
  const els = {
    setup: document.getElementById("mail-setup"),
    client: document.getElementById("mail-client"),
    status: document.getElementById("mail-status"),
    configBanner: document.getElementById("mail-config-banner"),
    accounts: document.getElementById("mail-accounts"),
    btnConnect: document.getElementById("btn-connect-gmail"),
    btnBackSetup: document.getElementById("btn-back-setup"),
    btnClientSync: document.getElementById("btn-client-sync"),
    accountLabel: document.getElementById("mail-account-label"),
    sidebar: document.getElementById("mail-sidebar"),
    folderTitle: document.getElementById("mail-folder-title"),
    listCount: document.getElementById("mail-list-count"),
    list: document.getElementById("mail-list"),
    listEmpty: document.getElementById("mail-list-empty"),
    listFooter: document.getElementById("mail-list-footer"),
    btnLoadMore: document.getElementById("btn-load-more"),
    searchForm: document.getElementById("mail-search-form"),
    search: document.getElementById("mail-search"),
    readerEmpty: document.getElementById("mail-reader-empty"),
    readerContent: document.getElementById("mail-reader-content"),
    readerPane: document.getElementById("mail-reader"),
    readerBack: document.getElementById("btn-reader-back"),
    layout: document.querySelector(".mail-layout"),
    readerSubject: document.getElementById("reader-subject"),
    readerAvatar: document.getElementById("reader-avatar"),
    readerFromName: document.getElementById("reader-from-name"),
    readerFromEmail: document.getElementById("reader-from-email"),
    readerTo: document.getElementById("reader-to"),
    readerCcRow: document.getElementById("reader-cc-row"),
    readerCc: document.getElementById("reader-cc"),
    readerDate: document.getElementById("reader-date"),
    readerBody: document.getElementById("reader-body"),
  };

  const MAIN_LABELS = new Set([
    "INBOX",
    "__ALL__",
    "STARRED",
    "IMPORTANT",
    "SENT",
    "DRAFT",
    "CATEGORY_PERSONAL",
    "CATEGORY_SOCIAL",
    "CATEGORY_PROMOTIONS",
    "CATEGORY_UPDATES",
    "CATEGORY_FORUMS",
    "SPAM",
    "TRASH",
  ]);

  let state = {
    shell: "hub",
    accounts: [],
    accountId: null,
    account: null,
    labels: [],
    activeLabelId: "INBOX",
    activeLabelName: "Inbox",
    messages: [],
    activeMessageId: null,
    searchQuery: "",
    nextPageToken: null,
    totalEstimate: 0,
    loadingMore: false,
    view: "setup",
  };

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function toast(msg) {
    try {
      if (window.top?.showMySpaceToast) window.top.showMySpaceToast(String(msg ?? ""));
      else window.showMySpaceToast?.(String(msg ?? ""));
    } catch {
    }
  }

  function setStatus(msg, tone = "info") {
    if (!els.status) return;
    els.status.textContent = String(msg ?? "");
    els.status.dataset.tone = tone;
  }

  function formatWhen(raw) {
    try {
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return "";
      const now = new Date();
      const sameDay = d.toDateString() === now.toDateString();
      if (sameDay) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      return d.toLocaleDateString([], { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  }

  function formatWhenFull(raw) {
    try {
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  function displaySender(from) {
    const { name, email } = parseAddress(from);
    return name || email || "(no sender)";
  }

  function parseAddress(raw) {
    const s = String(raw || "").trim();
    const m = s.match(/^(.+?)\s*<([^>]+)>$/);
    if (m) return { name: m[1].replace(/^"|"$/g, "").trim(), email: m[2].trim() };
    return { name: s, email: s };
  }

  function avatarLetter(from) {
    const { name, email } = parseAddress(from);
    const ch = (name || email || "?").trim().charAt(0);
    return ch ? ch.toUpperCase() : "?";
  }

  function folderListArgs() {
    if (state.searchQuery) {
      return { labelIds: [], q: state.searchQuery };
    }
    if (state.activeLabelId === "__ALL__") {
      return { labelIds: [], q: "" };
    }
    return { labelIds: [state.activeLabelId], q: "" };
  }

  function ensureMailWorkspaceVisible() {
    state.shell = "mail";
    const hub = document.getElementById("hub");
    const hubService = document.getElementById("hub-service");
    const hubEmbed = document.getElementById("hub-embed");
    const mail = document.getElementById("mail-workspace");
    if (hub) hub.hidden = true;
    if (hubService) hubService.hidden = true;
    if (hubEmbed) hubEmbed.hidden = true;
    if (mail) mail.hidden = false;
  }

  function showSetup() {
    state.view = "setup";
    ensureMailWorkspaceVisible();
    if (els.setup) els.setup.hidden = false;
    if (els.client) els.client.hidden = true;
  }

  function showClient() {
    state.view = "client";
    ensureMailWorkspaceVisible();
    if (els.setup) els.setup.hidden = true;
    if (els.client) els.client.hidden = false;
  }

  async function openClient(accountId) {
    const account = state.accounts.find((a) => a.id === accountId);
    if (!account) return;
    state.accountId = accountId;
    state.account = account;
    state.activeLabelId = "INBOX";
    state.activeLabelName = tt("service.mail.inbox");
    state.activeMessageId = null;
    state.searchQuery = "";
    if (els.search) els.search.value = "";
    if (els.accountLabel) els.accountLabel.textContent = account.email;
    showClient();
    clearReader();
    await loadLabels();
    await loadFolder();
  }

  function clearReader() {
    if (els.readerEmpty) els.readerEmpty.hidden = false;
    if (els.readerContent) els.readerContent.hidden = true;
    state.activeMessageId = null;
    els.layout?.classList.remove("is-reading");
  }

  function focusReaderTop() {
    if (els.readerPane) els.readerPane.scrollTop = 0;
    try {
      els.readerContent?.scrollIntoView?.({ block: "start", behavior: "auto" });
    } catch {
    }
  }

  function showReadingMode(on) {
    els.layout?.classList.toggle("is-reading", Boolean(on));
    if (on) focusReaderTop();
  }

  function renderConfigBanner(cfg) {
    if (!els.configBanner) return;
    if (cfg?.configured) {
      els.configBanner.hidden = true;
      els.configBanner.innerHTML = "";
      return;
    }
    els.configBanner.hidden = false;
    els.configBanner.innerHTML = `
      <strong>Gmail OAuth not configured</strong>
      <p>Copy <code>config/mail-oauth.example.json</code> to <code>config/mail-oauth.json</code> and paste your Google client credentials.</p>`;
  }

  async function loadConfigStatus() {
    if (!api?.configStatus) return;
    const cfg = await api.configStatus();
    if (cfg?.ok !== false) renderConfigBanner(cfg);
  }

  function renderSetupAccounts() {
    if (!els.accounts) return;
    els.accounts.innerHTML = "";
    if (!state.accounts.length) {
      els.accounts.innerHTML = `<p class="mail-sub">${escapeHtml(tt("service.mail.noAccounts"))}</p>`;
      return;
    }
    for (const acc of state.accounts) {
      const card = document.createElement("div");
      card.className = "mail-account-card";
      card.innerHTML = `
        <div class="mail-account-email">${escapeHtml(acc.email)}</div>
        <div class="mail-account-meta">${escapeHtml(acc.provider)} · ${escapeHtml(acc.status)}</div>
        <div class="mail-head-actions">
          <button type="button" class="mail-btn mail-btn-primary" data-open="${escapeHtml(acc.id)}">${escapeHtml(tt("service.mail.openMail"))}</button>
          <button type="button" class="mail-btn mail-btn-danger" data-disconnect="${escapeHtml(acc.id)}">${escapeHtml(tt("service.mail.disconnect"))}</button>
        </div>`;
      els.accounts.appendChild(card);
    }
    els.accounts.querySelectorAll("[data-open]").forEach((btn) => {
      btn.addEventListener("click", () => openClient(btn.dataset.open));
    });
    els.accounts.querySelectorAll("[data-disconnect]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const res = await api.disconnect(btn.dataset.disconnect);
        if (!res?.ok) toast(res?.error || "Could not disconnect");
        await refresh();
      });
    });
  }

  function sidebarGroups(labels) {
    const folders = labels.filter((l) => MAIN_LABELS.has(l.id) && l.id !== "__ALL__");
    const inboxIdx = folders.findIndex((l) => l.id === "INBOX");
    const allMail = {
      id: "__ALL__",
      displayName: tt("service.mail.folder.allMail"),
      name: tt("service.mail.folder.allMail"),
      type: "system",
      messagesTotal: 0,
      messagesUnread: 0,
    };
    folders.splice(inboxIdx >= 0 ? inboxIdx + 1 : 0, 0, allMail);
    const custom = labels.filter((l) => l.type === "user");
    return { folders, custom };
  }

  function renderSidebar() {
    if (!els.sidebar) return;
    const { folders, custom } = sidebarGroups(state.labels);
    const renderBtn = (label) => {
      const active = label.id === state.activeLabelId ? " is-active" : "";
      const count =
        label.id === state.activeLabelId && state.totalEstimate
          ? label.messagesUnread || ""
          : label.messagesUnread || "";
      const name = folderDisplayName(label);
      return `<button type="button" class="mail-folder-btn${active}" data-label="${escapeHtml(label.id)}" data-name="${escapeHtml(name)}">
        <span class="mail-folder-name">${escapeHtml(name)}</span>
        ${count ? `<span class="mail-folder-count">${count}</span>` : ""}
      </button>`;
    };
    els.sidebar.innerHTML = `
      <button type="button" class="mail-sidebar-compose" id="btn-compose" disabled data-i18n-title="service.mail.composeSoon" title="Coming soon">${escapeHtml(tt("service.mail.compose"))}</button>
      <div class="mail-sidebar-section">
        ${folders.map(renderBtn).join("")}
      </div>
      ${
        custom.length
          ? `<div class="mail-sidebar-section">
              <div class="mail-sidebar-label">${escapeHtml(tt("service.mail.labels"))}</div>
              ${custom.map(renderBtn).join("")}
            </div>`
          : ""
      }`;
    els.sidebar.querySelectorAll("[data-label]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        state.activeLabelId = btn.dataset.label;
        state.activeLabelName = btn.dataset.name || btn.dataset.label;
        state.activeMessageId = null;
        state.nextPageToken = null;
        clearReader();
        renderSidebar();
        await loadFolder(true);
      });
    });
  }

  function renderLoadMore() {
    if (!els.listFooter || !els.btnLoadMore) return;
    if (state.nextPageToken) {
      els.listFooter.hidden = false;
      els.btnLoadMore.disabled = state.loadingMore;
      els.btnLoadMore.textContent = state.loadingMore ? tt("service.mail.loading") : tt("service.mail.loadMore");
    } else {
      els.listFooter.hidden = true;
    }
  }

  function renderMessageList() {
    if (!els.list || !els.listEmpty) return;
    els.list.innerHTML = "";
    const title = state.searchQuery
      ? tt("service.mail.searchTitle", { query: state.searchQuery })
      : state.activeLabelName;
    if (els.folderTitle) els.folderTitle.textContent = title;
    if (els.listCount) {
      const shown = state.messages.length;
      const total = state.totalEstimate || shown;
      if (shown && total > shown) {
        els.listCount.textContent = tt("service.mail.messagesOf", { shown, total });
      } else if (shown) {
        els.listCount.textContent = tt("service.mail.messagesCount", { count: shown });
      } else {
        els.listCount.textContent = "";
      }
    }
    if (!state.messages.length) {
      els.listEmpty.hidden = false;
      renderLoadMore();
      return;
    }
    els.listEmpty.hidden = true;
    for (const msg of state.messages) {
      const row = document.createElement("article");
      row.className = `mail-row${msg.unread ? " is-unread" : ""}${msg.id === state.activeMessageId ? " is-active" : ""}`;
      row.innerHTML = `
        <div class="mail-row-sender">${escapeHtml(displaySender(msg.from))}</div>
        <div class="mail-row-content">
          <span class="mail-row-subject">${escapeHtml(msg.subject || "(No subject)")}</span>
          <span class="mail-row-sep"> — </span>
          <span class="mail-row-snippet">${escapeHtml(msg.snippet || "")}</span>
        </div>
        <div class="mail-row-time">${escapeHtml(formatWhen(msg.date))}</div>`;
      row.addEventListener("click", () => openMessage(msg.id));
      els.list.appendChild(row);
    }
    renderLoadMore();
  }

  function renderReader(msg, { loading = false } = {}) {
    if (!msg) return;
    if (els.readerEmpty) els.readerEmpty.hidden = true;
    if (els.readerContent) els.readerContent.hidden = false;
    showReadingMode(true);
    const from = parseAddress(msg.from);
    if (els.readerSubject) els.readerSubject.textContent = msg.subject || "(No subject)";
    if (els.readerAvatar) els.readerAvatar.textContent = avatarLetter(msg.from);
    if (els.readerFromName) els.readerFromName.textContent = displaySender(msg.from);
    if (els.readerFromEmail) {
      els.readerFromEmail.textContent = from.email && from.email !== from.name ? `<${from.email}>` : "";
    }
    if (els.readerTo) els.readerTo.textContent = msg.to || "me";
    if (els.readerCcRow && els.readerCc) {
      if (msg.cc) {
        els.readerCcRow.hidden = false;
        els.readerCc.textContent = msg.cc;
      } else {
        els.readerCcRow.hidden = true;
      }
    }
    if (els.readerDate) els.readerDate.textContent = formatWhenFull(msg.date);
    if (els.readerBody) {
      els.readerBody.className = "mail-reader-body";
      if (loading && !msg.bodyHtml && !msg.bodyText) {
        els.readerBody.classList.add("plain");
        els.readerBody.textContent = msg.snippet
          ? `${msg.snippet}\n\nLoading full message…`
          : "Loading…";
      } else if (msg.bodyHtml) {
        els.readerBody.innerHTML = "";
        const frame = document.createElement("iframe");
        frame.className = "mail-reader-frame";
        frame.setAttribute("sandbox", "allow-same-origin allow-popups allow-popups-to-escape-sandbox");
        frame.srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><base target="_blank"><style>body{margin:0;font:14px/1.55 Segoe UI,Arial,sans-serif;color:#202124;word-break:break-word}img{max-width:100%;height:auto}</style></head><body>${msg.bodyHtml}</body></html>`;
        els.readerBody.appendChild(frame);
      } else {
        els.readerBody.classList.add("plain");
        els.readerBody.textContent = msg.bodyText || msg.snippet || "";
      }
    }
    focusReaderTop();
  }

  async function loadLabels() {
    if (!state.accountId) return;
    const cached = await api.listLabels({ accountId: state.accountId, cacheOnly: true });
    if (cached?.ok && cached.labels?.length) {
      state.labels = cached.labels;
      renderSidebar();
    }
    const res = await api.listLabels({ accountId: state.accountId });
    if (!res?.ok) {
      if (!state.labels.length) {
        toast(res?.error || "Could not load folders");
        state.labels = [
          {
            id: "INBOX",
            displayName: "Inbox",
            name: "Inbox",
            type: "system",
            messagesTotal: 0,
            messagesUnread: 0,
          },
        ];
        renderSidebar();
      }
      return;
    }
    state.labels = res.labels || [];
    renderSidebar();
  }

  async function loadFolder(reset = true) {
    if (!state.accountId) return;
    if (reset) {
      state.nextPageToken = null;
      state.totalEstimate = 0;
    }
    const folder = folderListArgs();
    const listArgs = {
      accountId: state.accountId,
      maxResults: 25,
      labelIds: folder.labelIds,
      q: folder.q || undefined,
      pageToken: reset ? undefined : state.nextPageToken,
    };

    if (reset) {
      const cached = await api.listMessages({ ...listArgs, cacheOnly: true });
      if (cached?.ok && cached.messages?.length) {
        state.messages = cached.messages;
        state.nextPageToken = cached.nextPageToken || null;
        state.totalEstimate = Number(cached.resultSizeEstimate) || cached.messages.length;
        if (els.listEmpty) els.listEmpty.hidden = true;
        renderMessageList();
      } else if (!state.messages.length && els.listEmpty) {
        els.listEmpty.hidden = false;
        els.listEmpty.textContent = tt("service.mail.loading");
      }
    }

    const res = await api.listMessages(listArgs);
    if (!res?.ok) {
      toast(res?.error || "Could not load messages");
      if (!state.messages.length && els.listEmpty) {
        els.listEmpty.textContent = "Could not load messages";
      }
      renderMessageList();
      return;
    }
    const batch = res.messages || [];
    state.messages = reset ? batch : [...state.messages, ...batch];
    state.nextPageToken = res.nextPageToken || null;
    state.totalEstimate = Number(res.resultSizeEstimate) || state.messages.length;
    renderMessageList();
  }

  async function loadMore() {
    if (!state.nextPageToken || state.loadingMore) return;
    state.loadingMore = true;
    renderLoadMore();
    try {
      await loadFolder(false);
    } finally {
      state.loadingMore = false;
      renderLoadMore();
    }
  }

  async function openMessage(messageId) {
    if (!state.accountId) return;
    state.activeMessageId = messageId;
    renderMessageList();
    showReadingMode(true);

    const preview = state.messages.find((m) => m.id === messageId);
    if (preview) {
      renderReader(
        {
          ...preview,
          to: "me",
          bodyText: "",
          bodyHtml: "",
        },
        { loading: true }
      );
    } else {
      focusReaderTop();
    }

    try {
      const res = await api.getMessage({ accountId: state.accountId, messageId });
      if (!res?.ok) {
        toast(res?.error || "Could not load message");
        if (preview) renderReader({ ...preview, bodyText: preview.snippet || "" });
        return;
      }
      if (state.activeMessageId === messageId) renderReader(res.message);
    } catch (err) {
      toast(err?.message || "Could not load message");
    }
  }

  async function refresh({ openFirst = false } = {}) {
    if (!api) {
      setStatus("Mail API unavailable", "error");
      return;
    }
    await loadConfigStatus();
    const res = await api.status();
    if (!res?.ok) {
      setStatus(res?.error || "Mail unavailable", "error");
      return;
    }
    state.accounts = res.accounts || [];
    setStatus(
      state.accounts.length
        ? tt("service.mail.accountsConnected", { count: state.accounts.length })
        : tt("service.mail.connectPrompt")
    );
    renderSetupAccounts();

    if (state.shell !== "mail" && !openFirst) {
      try {
        await window.MySpaceConnectHub?.refreshConnections?.();
      } catch {
        /* ignore */
      }
      return;
    }

    if (openFirst) state.shell = "mail";

    if (!state.accounts.length) {
      showSetup();
      return;
    }
    if (openFirst || state.view === "client") {
      const id =
        state.accountId && state.accounts.some((a) => a.id === state.accountId)
          ? state.accountId
          : state.accounts[0].id;
      await openClient(id);
    } else {
      showSetup();
    }
  }

  function waitForConnectEvent(ms = 15000) {
    if (!api?.onEvent) return Promise.resolve(null);
    return new Promise((resolve) => {
      let done = false;
      let unsub = null;
      const finish = (value) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        unsub?.();
        resolve(value);
      };
      unsub = api.onEvent((data) => {
        if (data?.channel === "connect-result") finish(data);
      });
      const timer = setTimeout(() => finish(null), ms);
    });
  }

  async function recoverConnectResult(fallback) {
    if (fallback?.ok && fallback.account) return fallback;
    const eventResult = await waitForConnectEvent(2000);
    if (eventResult?.ok && eventResult.account) return eventResult;
    const st = await api.status();
    const account = st?.accounts?.[0];
    if (account) return { ok: true, account, recovered: true };
    return fallback || { ok: false, error: "Could not confirm Gmail connection" };
  }

  async function finishConnect(res) {
    if (!res?.ok || !res.account) {
      setStatus(res?.error || "Could not connect Gmail", "error");
      toast(res?.error || "Could not connect Gmail");
      return;
    }
    toast(`Connected ${res.account.email}`);
    await refresh();
    try {
      await api.sync({ accountId: res.account.id });
    } catch {
    }
    await openClient(res.account.id);
  }

  els.btnConnect?.addEventListener("click", async () => {
    if (!api?.connect) {
      setStatus("Mail API unavailable", "error");
      return;
    }
    els.btnConnect.disabled = true;
    try {
      const cfg = api.configStatus ? await api.configStatus() : null;
      if (cfg && cfg.ok !== false && !cfg.configured) {
        renderConfigBanner(cfg);
        setStatus("Add config/mail-oauth.json first", "error");
        toast("Add config/mail-oauth.json with Google OAuth credentials first");
        return;
      }
      setStatus("Opening Google sign-in in your browser…");
      toast("Opening Google sign-in in your browser…");
      const eventWait = waitForConnectEvent(30000);
      let res = null;
      try {
        res = await api.connect("gmail");
      } catch (err) {
        res = {
          ok: false,
          error: err?.message || String(err),
          interrupted: /destroyed/i.test(String(err?.message || err)),
        };
      }
      if (!res?.ok && (res?.interrupted || /destroyed/i.test(String(res?.error || "")))) {
        setStatus("Sign-in complete — loading account…");
        const eventResult = await eventWait;
        res = await recoverConnectResult(eventResult || res);
      }
      await finishConnect(res);
    } catch (err) {
      setStatus(err?.message || String(err), "error");
      toast(err?.message || String(err));
    } finally {
      els.btnConnect.disabled = false;
    }
  });

  els.btnBackSetup?.addEventListener("click", () => {
    showSetup();
    renderSetupAccounts();
  });

  document.getElementById("btn-mail-to-hub")?.addEventListener("click", () => {
    state.shell = "hub";
    window.MySpaceConnectHub?.show?.();
  });
  document.getElementById("btn-client-to-hub")?.addEventListener("click", () => {
    state.shell = "hub";
    window.MySpaceConnectHub?.show?.();
  });

  els.readerBack?.addEventListener("click", () => {
    clearReader();
    renderMessageList();
  });
  
  els.btnClientSync?.addEventListener("click", async () => {
    if (!state.accountId) return;
    toast("Syncing mail…");
    const res = await api.sync({ accountId: state.accountId });
    if (!res?.ok) toast(res?.error || "Sync failed");
    else toast("Sync complete");
    await loadLabels();
    await loadFolder(true);
  });

  els.searchForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    state.searchQuery = String(els.search?.value || "").trim();
    state.activeMessageId = null;
    state.nextPageToken = null;
    clearReader();
    await loadFolder(true);
  });

  els.btnLoadMore?.addEventListener("click", () => loadMore());

  window.MailWorkspace = {
    enter: () => {
      state.shell = "mail";
      return refresh({ openFirst: true });
    },
    leaveToHub: () => {
      state.shell = "hub";
      const hub = document.getElementById("hub");
      const hubService = document.getElementById("hub-service");
      const hubEmbed = document.getElementById("hub-embed");
      const mail = document.getElementById("mail-workspace");
      if (hubService) hubService.hidden = true;
      if (hubEmbed) hubEmbed.hidden = true;
      if (mail) mail.hidden = true;
      if (hub) hub.hidden = false;
    },
    hasAccount: () => state.accounts.length > 0,
    refreshStatus: () => refresh({ openFirst: false }),
  };

  function onI18nApplied() {
    if (state.view === "setup") renderSetupAccounts();
    if (state.view === "client") {
      renderSidebar();
      renderLoadMore();
      renderMessageList();
    }
  }
  window.addEventListener("myspace-i18n-applied", onI18nApplied);
  window.addEventListener("myspace-i18n-ready", onI18nApplied);

  refresh({ openFirst: false });
})();