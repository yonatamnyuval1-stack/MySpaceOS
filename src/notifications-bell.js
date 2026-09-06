(function () {
  const APP_LABELS = {
    "day-planner": "Today",
    contacts: "Contacts",
    contracts: "Contracts",
    coupons: "Coupons",
    stocks: "Stocks",
    "world-clock": "Clock",
    builds: "Builds",
    "os-bridge": "OS Bridge",
    mail: "Mail",
    system: "My Space",
  };

  const BELL_SVG =
    '<svg class="taskbar-svg-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M6 9.5a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7"/>' +
    '<path d="M10.3 19.5a1.7 1.7 0 0 0 3.4 0"/>' +
    "</svg>";

  const PAGE_ICON = "brand/atom-white.png";

  let items = [];
  let unread = 0;
  let unsub = null;
  let pageRoot = null;
  let mailPrefs = { mailAlertsEnabled: true, blockedSenders: [] };

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatWhen(iso) {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      const now = new Date();
      const sameDay = d.toDateString() === now.toDateString();
      if (sameDay) {
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }
      return d.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  function updateBadge() {
    const badge = document.getElementById("notifications-badge");
    const btn = document.getElementById("btn-notifications");
    if (!badge) return;
    if (unread > 0) {
      badge.hidden = false;
      badge.textContent = unread > 99 ? "99+" : String(unread);
      btn?.classList.add("has-unread");
    } else {
      badge.hidden = true;
      badge.textContent = "0";
      btn?.classList.remove("has-unread");
    }
  }

  function isUpdateNotification(n) {
    return (
      n?.type === "system-update" ||
      n?.route?.action === "apply-update" ||
      Boolean(n?.route?.updateId)
    );
  }

  async function applyUpdate(n) {
    const updateId = n?.route?.updateId;
    if (!updateId) {
      window.showMySpaceToast?.("Update id missing");
      return;
    }
    window.showMySpaceToast?.("Restarting to apply update…");
    if (n?.id) await window.mySpace?.notifications?.markRead?.(n.id);
    const res = await window.mySpace?.updates?.apply?.(updateId);
    if (res && res.ok === false) {
      window.showMySpaceToast?.(res.error || "Could not apply update");
    }
  }

  function isMailNotification(n) {
    return n?.appId === "mail" || n?.type === "mail-new";
  }

  function extractEmail(text) {
    const m = String(text || "").match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
    return m ? m[0].toLowerCase() : "";
  }

  function senderKeyFromNotification(n) {
    const direct = String(n?.route?.fromEmail || "").trim().toLowerCase();
    if (direct.includes("@")) return direct;

    const from = String(n?.route?.from || "").trim();
    const fromEmail = extractEmail(from);
    if (fromEmail) return fromEmail;

    const titleEmail = extractEmail(n?.title);
    if (titleEmail) return titleEmail;

    const bodyEmail = extractEmail(n?.body);
    if (bodyEmail) return bodyEmail;

    if (from) {
      const name = from.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().toLowerCase();
      if (name.length >= 2) return name;
    }

    const fromName = String(n?.route?.fromName || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (fromName.length >= 2) return fromName;

    const title = String(n?.title || "").trim();
    const namePart = title.split(/\s+[—–-]\s+/)[0]?.trim().toLowerCase();
    if (namePart && namePart.length >= 2 && !namePart.includes("new mail")) return namePart;

    return "";
  }

  function openApp(appId, notification) {
    if (notification?.route?.action === "open-resolve") {
      const page = notification?.route?.page || "inbox";
      const incidentId = notification?.route?.incidentId || null;
      if (window.MySpaceResolve?.open) {
        window.MySpaceResolve.open({ page, incidentId, forceRefresh: true });
      } else {
        window.showMySpaceToast?.("Resolve unavailable.");
      }
      return;
    }
    if (!appId || appId === "system") return;
    const apps = window.MySpaceConfig?.getApps?.() || [];
    const app = apps.find((a) => a.id === appId || a.module === appId);
    if (!app) {
      window.showMySpaceToast?.(`Open ${APP_LABELS[appId] || appId} to view details`);
      return;
    }
    if (typeof window.launchMySpaceApp === "function") {
      window.launchMySpaceApp(app, {
        reuse: true,
        route: notification?.route || null,
      });
    }
  }

  function renderMailSettings() {
    if (!pageRoot) return;
    const toggle = pageRoot.querySelector("#notif-mail-alerts");
    const blockList = pageRoot.querySelector("#notif-blocklist");
    if (toggle) toggle.checked = mailPrefs.mailAlertsEnabled !== false;
    if (!blockList) return;
    const blocked = Array.isArray(mailPrefs.blockedSenders) ? mailPrefs.blockedSenders : [];
    if (!blocked.length) {
      blockList.innerHTML = '<p class="notif-settings-empty">No blocked senders</p>';
      return;
    }
    blockList.innerHTML = blocked
      .map(
        (email) => `
        <div class="notif-block-row">
          <span class="notif-block-email">${escapeHtml(email)}</span>
          <button type="button" class="notif-btn notif-btn-quiet notif-block-remove" data-email="${escapeHtml(email)}">Remove</button>
        </div>`
      )
      .join("");
    blockList.querySelectorAll(".notif-block-remove").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const res = await window.mySpace?.notifications?.unblockSender?.(btn.dataset.email);
        if (res?.ok) {
          mailPrefs = res.prefs || mailPrefs;
          renderMailSettings();
          window.showMySpaceToast?.("Sender removed from blocklist");
        } else {
          window.showMySpaceToast?.(res?.error || "Could not remove sender");
        }
      });
    });
  }

  async function loadMailPrefs() {
    const res = await window.mySpace?.notifications?.prefs?.();
    if (res?.ok && res.prefs) {
      mailPrefs = res.prefs;
      renderMailSettings();
    }
  }

  function renderPageList() {
    if (!pageRoot) return;
    const list = pageRoot.querySelector("#notif-page-list");
    const empty = pageRoot.querySelector("#notif-page-empty");
    const count = pageRoot.querySelector("#notif-page-count");
    if (!list || !empty) return;

    if (count) {
      count.textContent =
        unread > 0 ? `${unread} unread` : items.length ? `${items.length} total` : "Inbox empty";
    }

    empty.hidden = items.length > 0;
    list.hidden = items.length === 0;
    list.innerHTML = items
      .map((n) => {
        const app = APP_LABELS[n.appId] || n.appId;
        const update = isUpdateNotification(n);
        const mail = isMailNotification(n);
        const senderKey = mail ? senderKeyFromNotification(n) : "";
        const actionLabel = update ? "Restart & Update" : "Open";
        return `
        <article class="notif-card ${n.read ? "is-read" : "is-unread"}${update ? " is-update" : ""}" data-id="${escapeHtml(n.id)}">
          <div class="notif-card-main">
            <div class="notif-card-meta">
              <span class="notif-card-app">${escapeHtml(update ? "Update" : app)}</span>
              <span class="notif-card-time">${escapeHtml(formatWhen(n.createdAt))}</span>
            </div>
            <h3 class="notif-card-title">${escapeHtml(n.title)}</h3>
            ${n.body ? `<p class="notif-card-body">${escapeHtml(n.body)}</p>` : ""}
          </div>
          <div class="notif-card-actions">
            <button type="button" class="notif-btn${update ? " notif-btn-update" : ""}" data-open="${escapeHtml(n.id)}" data-app="${escapeHtml(n.appId)}">${actionLabel}</button>
            <button type="button" class="notif-btn notif-btn-quiet" data-dismiss="${escapeHtml(n.id)}">Dismiss</button>
            ${
              mail
                ? `<button type="button" class="notif-btn notif-btn-block" data-block-sender="${escapeHtml(n.id)}" data-email="${escapeHtml(senderKey)}" title="${
                    senderKey ? `Block alerts from ${escapeHtml(senderKey)}` : "Block this sender"
                  }">Block</button>`
                : ""
            }
          </div>
        </article>`;
      })
      .join("");

    list.querySelectorAll("[data-open]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const n = items.find((x) => x.id === btn.dataset.open);
        if (n && isUpdateNotification(n)) {
          await applyUpdate(n);
          return;
        }
        await window.mySpace?.notifications?.markRead?.(btn.dataset.open);
        openApp(btn.dataset.app, n);
      });
    });
    list.querySelectorAll("[data-dismiss]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const n = items.find((x) => x.id === btn.dataset.dismiss);
        if (n && isUpdateNotification(n) && n.route?.updateId) {
          await window.mySpace?.updates?.skip?.(n.route.updateId);
        }
        await window.mySpace?.notifications?.remove?.(btn.dataset.dismiss);
      });
    });
    list.querySelectorAll("[data-block-sender]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const n = items.find((x) => x.id === btn.dataset.blockSender);
        const email = String(btn.dataset.email || senderKeyFromNotification(n) || "").trim();
        if (!email) {
          window.showMySpaceToast?.("Could not identify sender");
          return;
        }
        btn.disabled = true;
        const res = await window.mySpace?.notifications?.blockSender?.(email);
        if (!res?.ok) {
          btn.disabled = false;
          window.showMySpaceToast?.(res?.error || "Could not block sender");
          return;
        }
        mailPrefs = res.prefs || mailPrefs;
        await window.mySpace?.notifications?.remove?.(btn.dataset.blockSender);
        window.showMySpaceToast?.(`Blocked ${email}`);
        renderMailSettings();
      });
    });
  }

  function buildPage() {
    const root = document.createElement("div");
    root.className = "notifications-page";
    root.innerHTML = `
      <header class="notifications-page-head">
        <div class="notifications-page-head-brand">
          <img src="brand/atom-white.png" alt="" width="32" height="32" class="notifications-page-mark" />
          <div>
            <h1>Notifications</h1>
            <p class="notifications-page-sub" id="notif-page-count">Loading…</p>
          </div>
        </div>
        <div class="notifications-page-actions">
          <button type="button" class="notif-btn notif-btn-icon" id="notif-settings-btn" title="Settings" aria-label="Notification settings">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
          <button type="button" class="notif-btn" id="notif-mark-all">Mark all read</button>
          <button type="button" class="notif-btn notif-btn-quiet" id="notif-clear">Clear all</button>
        </div>
      </header>
      <div class="notifications-page-body">
        <div class="notif-page-list" id="notif-page-list"></div>
        <div class="notif-page-empty" id="notif-page-empty" hidden>
          <img src="brand/atom-white.png" alt="" width="40" height="40" class="notif-empty-mark" />
          <strong>No notifications</strong>
        </div>
      </div>
      <div class="notif-settings-overlay" id="notif-settings-overlay" hidden>
        <div class="notif-settings-backdrop" data-close-settings></div>
        <aside class="notif-settings-panel" role="dialog" aria-labelledby="notif-settings-title">
          <header class="notif-settings-panel-head">
            <h2 id="notif-settings-title">Settings</h2>
            <button type="button" class="notif-btn notif-btn-quiet" data-close-settings aria-label="Close settings">Close</button>
          </header>
          <div class="notif-settings-panel-body">
            <section class="notif-settings" aria-labelledby="notif-mail-settings-title">
              <div class="notif-settings-head">
                <h3 id="notif-mail-settings-title">Mail alerts</h3>
                <p class="notif-settings-sub">New Gmail messages appear in the bell.</p>
              </div>
              <label class="notif-settings-toggle">
                <input type="checkbox" id="notif-mail-alerts" checked />
                <span>Show mail notifications</span>
              </label>
              <div class="notif-block-section">
                <label class="notif-block-label" for="notif-block-input">Blocked senders</label>
                <div class="notif-block-add">
                  <input type="email" id="notif-block-input" class="notif-block-input" placeholder="sender@example.com" autocomplete="off" />
                  <button type="button" class="notif-btn" id="notif-block-add">Add</button>
                </div>
                <div class="notif-blocklist" id="notif-blocklist"></div>
              </div>
            </section>
          </div>
        </aside>
      </div>
    `;

    root.querySelector("#notif-mark-all")?.addEventListener("click", async () => {
      await window.mySpace?.notifications?.markAllRead?.();
    });
    root.querySelector("#notif-clear")?.addEventListener("click", async () => {
      await window.mySpace?.notifications?.clear?.({});
    });

    const settingsOverlay = root.querySelector("#notif-settings-overlay");
    const openSettings = () => {
      if (!settingsOverlay) return;
      settingsOverlay.hidden = false;
      loadMailPrefs();
    };
    const closeSettings = () => {
      if (!settingsOverlay) return;
      settingsOverlay.hidden = true;
    };
    root.querySelector("#notif-settings-btn")?.addEventListener("click", openSettings);
    settingsOverlay?.querySelectorAll("[data-close-settings]").forEach((el) => {
      el.addEventListener("click", closeSettings);
    });

    root.querySelector("#notif-mail-alerts")?.addEventListener("change", async (e) => {
      const res = await window.mySpace?.notifications?.setPrefs?.({
        mailAlertsEnabled: e.target.checked,
      });
      if (res?.ok) {
        mailPrefs = res.prefs || mailPrefs;
        window.showMySpaceToast?.(e.target.checked ? "Mail alerts enabled" : "Mail alerts disabled");
      }
    });

    const addBlocked = async () => {
      const input = root.querySelector("#notif-block-input");
      const email = String(input?.value || "").trim();
      if (!email) return;
      const res = await window.mySpace?.notifications?.blockSender?.(email);
      if (res?.ok) {
        mailPrefs = res.prefs || mailPrefs;
        if (input) input.value = "";
        renderMailSettings();
        window.showMySpaceToast?.("Sender blocked");
      } else {
        window.showMySpaceToast?.(res?.error || "Could not block sender");
      }
    };
    root.querySelector("#notif-block-add")?.addEventListener("click", addBlocked);
    root.querySelector("#notif-block-input")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addBlocked();
      }
    });

    pageRoot = root;
    renderPageList();
    return root;
  }

  function openPage() {
    if (!window.MySpaceWorkspace?.openPanel) {
      window.showMySpaceToast?.("Workspace unavailable.");
      return null;
    }
    return window.MySpaceWorkspace.openPanel({
      appId: "notifications",
      title: "Notifications",
      iconSrc: PAGE_ICON,
      iconEmoji: null,
      reuse: true,
      rebuild: true,
      buildContent: () => buildPage(),
    });
  }

  function applySnapshot(snap) {
    if (!snap || (!snap.ok && !Array.isArray(snap.items))) return;
    items = Array.isArray(snap.items) ? snap.items : [];
    unread = Number(snap.unread) || items.filter((n) => !n.read).length;
    updateBadge();
    renderPageList();
  }

  async function refresh() {
    const snap = await window.mySpace?.notifications?.list?.();
    if (snap) applySnapshot(snap);
  }

  function decorateButton() {
    const btn = document.getElementById("btn-notifications");
    if (!btn) return;
    const badge = btn.querySelector("#notifications-badge");
    btn.innerHTML = BELL_SVG;
    if (badge) btn.appendChild(badge);
    else {
      const b = document.createElement("span");
      b.className = "taskbar-bell-badge";
      b.id = "notifications-badge";
      b.hidden = true;
      b.textContent = "0";
      btn.appendChild(b);
    }
    btn.removeAttribute("aria-expanded");
    btn.removeAttribute("aria-haspopup");
  }

  function bind() {
    const btn = document.getElementById("btn-notifications");
    if (!btn || !window.mySpace?.notifications) return;

    decorateButton();
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openPage();
    });

    unsub = window.mySpace.notifications.onUpdated((snap) => applySnapshot(snap));
    refresh();
  }

  window.MySpaceNotificationsBell = {
    open: openPage,
    refresh,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    setTimeout(bind, 0);
  }
})();