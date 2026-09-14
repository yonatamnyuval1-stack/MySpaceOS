(function () {
  function tt(key, vars) {
    return window.MySpaceI18n?.t?.(key, vars) ?? key;
  }

  const LOGOS = {
    gmail:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#EA4335" d="M2 6.5v11A2.5 2.5 0 0 0 4.5 20h1.5V9.4L12 14l6-4.6V20h1.5A2.5 2.5 0 0 0 22 17.5v-11c0-.7-.37-1.32-.94-1.66L12 11 2.94 4.84A1.9 1.9 0 0 0 2 6.5z"/><path fill="#4285F4" d="M22 6.5v.7L16 12.1V20h1.5A2.5 2.5 0 0 0 20 17.5v-11z"/><path fill="#34A853" d="M4 20h1.5V12.1L2 7.2v10.3A2.5 2.5 0 0 0 4.5 20H4z"/><path fill="#FBBC04" d="M22 6.5c0-.7-.37-1.32-.94-1.66L12 11 2.94 4.84A1.9 1.9 0 0 0 2 6.5L12 14l10-7.5z"/></svg>',
    outlook:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="11" height="14" rx="1.5" fill="#0078D4"/><path fill="#28A8EA" d="M14 8.5h7v10.2c0 .7-.6 1.3-1.3 1.3H14V8.5z"/><circle cx="8.5" cy="12" r="3" fill="#fff"/></svg>',
    yahoo:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="6" fill="#6001D2"/><text x="12" y="16" text-anchor="middle" fill="#fff" font-size="11" font-family="Arial" font-weight="700">Y!</text></svg>',
    whatsapp:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#25D366" d="M12 2C6.5 2 2 6.3 2 11.6c0 2 .6 3.8 1.8 5.4L2 22l5.2-1.7c1.5.8 3.2 1.3 5 1.3 5.5 0 10-4.3 10-9.6S17.5 2 12 2z"/><path fill="#fff" d="M16.7 14.4c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.1-.3.2-.5.1-1-.4-2.2-1.5-2.8-2.6-.1-.2 0-.3.1-.4l.6-.7c.1-.1.1-.3 0-.5l-.8-1.8c-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3-.6.6-.9 1.5-.9 2.4 0 1.4.9 2.8 1 3 .2.3 2.1 3.3 5.2 4.5.7.3 1.3.4 1.8.3.5-.1 1.4-.6 1.6-1.1.2-.5.2-1 .1-1.1-.1 0-.3-.1-.5-.2z"/></svg>',
    telegram:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#229ED9"/><path fill="#fff" d="M17.6 7.2 6.9 11.3c-.7.3-.7.7-.1.9l2.7.8 1 .3 4.6-2.9c.2-.1.4 0 .2.2l-3.3 3.1-.1 2.8c.2 0 .4-.2.5-.3l1.3-1.3 2.7 2c.5.3.8.1.9-.4l1.6-7.6c.2-.8-.3-1.1-.9-.8z"/></svg>',
    discord:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="7" fill="#5865F2"/><path fill="#fff" d="M8.3 8.7c1.4-.7 2.7-1 4-1.1h.1c1.3 0 2.6.4 4 1.1.3 1.2.5 2.4.4 3.6-1.2.6-2.3 1-3.5 1.2l-.5-1c.5-.1.9-.3 1.3-.5-.1 0-2.3 1-5.5 0 .4.2.8.4 1.3.5l-.5 1c-1.2-.2-2.3-.6-3.5-1.2 0-1.2.2-2.4.4-3.6zm2 3.4c-.5 0-.9-.5-.9-1s.4-1 .9-1 .9.5.9 1-.4 1-.9 1zm3.4 0c-.5 0-.9-.5-.9-1s.4-1 .9-1 .9.5.9 1-.4 1-.9 1z"/></svg>',
    slack:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#E01E5A" d="M8.5 12.8a1.7 1.7 0 1 1-1.7-1.7h1.7v1.7z"/><path fill="#E01E5A" d="M9.3 12.8A1.7 1.7 0 1 1 12.8 11V9.3H9.3v3.5z"/><path fill="#36C5F0" d="M11.2 8.5A1.7 1.7 0 1 1 12.8 6.8V8.5h-1.6z"/><path fill="#36C5F0" d="M11.2 9.3A1.7 1.7 0 0 1 9.5 11h3.3V9.3H11.2z"/><path fill="#2EB67D" d="M15.5 11.2A1.7 1.7 0 1 1 17.2 12.8H15.5v-1.6z"/><path fill="#2EB67D" d="M14.7 11.2A1.7 1.7 0 0 1 13 9.5v3.3h1.7V11.2z"/><path fill="#ECB22E" d="M12.8 15.5A1.7 1.7 0 1 1 11.2 17.2V15.5h1.6z"/><path fill="#ECB22E" d="M12.8 14.7A1.7 1.7 0 0 1 14.5 13H11.2v1.7h1.6z"/></svg>',
    messenger:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="url(#m)"/><path fill="#fff" d="m7.2 14.8 3.1-4.9c.3-.6 1.1-.7 1.6-.2l1.7 1.3c.2.1.4.1.6 0l2.3-1.7c.3-.2.7.1.5.5l-3.1 4.9c-.3.6-1.1.7-1.6.2l-1.7-1.3c-.2-.1-.4-.1-.6 0L7.7 15.3c-.3.2-.7-.1-.5-.5z"/><defs><linearGradient id="m" x1="4" y1="20" x2="20" y2="4"><stop stop-color="#0099FF"/><stop offset="1" stop-color="#A033FF"/></linearGradient></defs></svg>',
    teams:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="10" height="12" rx="2" fill="#6264A7"/><circle cx="16.5" cy="8.5" r="2.2" fill="#7B83EB"/><rect x="4" y="9" width="8" height="9" rx="1.5" fill="#4B53BC"/><text x="8" y="15.5" text-anchor="middle" fill="#fff" font-size="7" font-family="Arial" font-weight="700">T</text></svg>',
    instagram:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="7" fill="url(#ig)"/><rect x="6" y="6" width="12" height="12" rx="4" fill="none" stroke="#fff" stroke-width="1.6"/><circle cx="12" cy="12" r="3.1" fill="none" stroke="#fff" stroke-width="1.6"/><circle cx="16.2" cy="7.8" r="0.9" fill="#fff"/><defs><linearGradient id="ig" x1="4" y1="20" x2="20" y2="4"><stop stop-color="#F58529"/><stop offset=".5" stop-color="#DD2A7B"/><stop offset="1" stop-color="#8134AF"/></linearGradient></defs></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="6" fill="#111"/><path fill="#fff" d="m13.7 11.3 5-5.8h-1.2l-4.3 5-3.5-5H6.2l5.3 7.6-5.4 6.3h1.2l4.7-5.4 3.7 5.4h3.5l-5.5-7.7z"/></svg>',
    linkedin:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="4" fill="#0A66C2"/><path fill="#fff" d="M7.4 9.4H5.2v8.2h2.2V9.4zM6.3 5.4A1.3 1.3 0 1 0 6.3 8a1.3 1.3 0 0 0 0-2.6zM18.8 13c0-2.4-1.3-4-3.3-4-1.5 0-2.2.8-2.6 1.4V9.4H10.7c0 1.1 0 8.2 0 8.2h2.2v-4.6c0-.2 0-.5.1-.7.2-.5.7-1.1 1.5-1.1 1.1 0 1.5.8 1.5 2v4.4h2.2V13z"/></svg>',
    google:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h5.9c-.3 1.4-1 2.6-2.1 3.4v2.8h3.4c2-1.8 3.3-4.5 3.3-8.3z"/><path fill="#34A853" d="M12 23c2.8 0 5.2-.9 7-2.5l-3.4-2.8c-.9.6-2.1 1-3.6 1-2.8 0-5.1-1.9-6-4.4H2.5v2.9C4.2 20.7 7.8 23 12 23z"/><path fill="#FBBC05" d="M6 14.3c-.2-.6-.4-1.3-.4-2s.1-1.4.4-2V7.5H2.5C1.8 8.9 1.4 10.4 1.4 12s.4 3.1 1.1 4.5L6 14.3z"/><path fill="#EA4335" d="M12 5.8c1.5 0 2.9.5 4 1.5l3-3C17.2 2.5 14.8 1.5 12 1.5 7.8 1.5 4.2 3.8 2.5 7.5L6 10.3c.9-2.5 3.2-4.5 6-4.5z"/></svg>',
    edge:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#0078D4" d="M12 2C7.2 2 3.3 5.4 2.3 10c1.4-2.4 4-4 6.9-4 3.9 0 7 3.1 7 7 0 .4 0 .8-.1 1.2C18.3 12.8 20 10.2 20 7.2 20 4.1 16.4 2 12 2z"/><path fill="#00BCF2" d="M12.1 22c3.9 0 7.1-2.5 8.3-6H13c-2.2 0-4-1.8-4-4 0-.4.1-.8.2-1.2C6.6 12 5 14.6 5 17.5 5 20.1 8.2 22 12.1 22z"/><path fill="#33C3F0" d="M12 7.5c-2.5 0-4.5 2-4.5 4.5S9.5 16.5 12 16.5 16.5 14.5 16.5 12 14.5 7.5 12 7.5z"/></svg>',
    browser:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="#1a73e8" stroke-width="1.8"/><path fill="none" stroke="#1a73e8" stroke-width="1.5" d="M3 12h18M12 3c2.5 2.8 4 6 4 9s-1.5 6.2-4 9c-2.5-2.8-4-6-4-9s1.5-6.2 4-9z"/></svg>',
    "myspace-browser":
      '<img class="hub-logo-img" src="logo.png" alt="" width="40" height="40" />',
    facebook:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="6" fill="#1877F2"/><path fill="#fff" d="M16.5 12.5h-2.2v7h-3v-7H9.5v-2.5h1.8V8.7c0-1.8 1.1-2.8 2.7-2.8.8 0 1.5.1 1.7.1v2.3h-1.2c-.9 0-1.1.4-1.1 1.1v1.6h2.4l-.3 2.5z"/></svg>',
    reddit:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#FF4500"/><circle cx="8.5" cy="12.2" r="1.4" fill="#fff"/><circle cx="15.5" cy="12.2" r="1.4" fill="#fff"/><path fill="none" stroke="#fff" stroke-width="1.4" d="M8.2 15.2c1.1 1 2.4 1.5 3.8 1.5s2.7-.5 3.8-1.5"/></svg>',
    tiktok:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="6" fill="#111"/><path fill="#25F4EE" d="M14.5 6.2v7.1c0 1.7-1.4 3.1-3.1 3.1S8.3 15 8.3 13.3s1.4-3.1 3.1-3.1c.2 0 .4 0 .6.1V8.1c-.2 0-.4-.1-.6-.1-3 0-5.4 2.4-5.4 5.4S7.8 18.8 10.8 18.8s5.4-2.4 5.4-5.4V9.5c.9.7 2.1 1.1 3.3 1.2V8.4c-1.8-.1-3.3-1.3-3.8-2.9-.4-.7-.6-1-.8-1.3h-1.4z"/><path fill="#FE2C55" d="M13.7 5.5c.4 1.3 1.4 2.3 2.7 2.8v2.2c-1.2-.1-2.4-.5-3.3-1.2v5.4c0 3-2.4 5.4-5.4 5.4-.9 0-1.8-.2-2.5-.6 1 .9 2.3 1.4 3.7 1.4 3 0 5.4-2.4 5.4-5.4V5.5h-.6z"/></svg>',
    ollama:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="6" fill="#111"/><text x="12" y="15.5" text-anchor="middle" fill="#fff" font-size="7" font-family="Arial" font-weight="700">OL</text></svg>',
    chatgpt:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="6" fill="#10A37F"/><path fill="#fff" d="M12.4 5.2c.8-.5 1.9-.2 2.4.6l.1.2c.4.7.2 1.5-.3 2l-1.1.9c.8.3 1.5.8 2 1.5.5.7.7 1.5.6 2.3l1.3.1c.9.1 1.5.9 1.4 1.8-.1.9-.9 1.5-1.8 1.4l-1.3-.1c-.2.8-.6 1.5-1.2 2-.6.5-1.4.8-2.2.8l-.1-1.4c.5 0 1-.2 1.3-.5.4-.3.6-.8.7-1.2l-2.1-.9c-.3.2-.7.3-1.1.3l.1 1.4c0 .9-.7 1.6-1.6 1.6s-1.6-.7-1.6-1.6l-.1-1.4c-.4 0-.8-.1-1.1-.3l-1.2 1.1c-.6.6-1.6.5-2.1-.2-.6-.6-.5-1.6.2-2.1l1.2-1.1c-.4-.6-.6-1.3-.5-2l-1.3-.1c-.9-.1-1.5-.9-1.4-1.8.1-.9.9-1.5 1.8-1.4l1.3.1c.2-.8.6-1.5 1.2-2 .6-.5 1.4-.8 2.2-.8l.1 1.4c-.5 0-1 .2-1.3.5-.4.3-.6.8-.7 1.2l2.1.9c.3-.2.7-.3 1.1-.3l-.1-1.4c0-.9.7-1.6 1.6-1.6.2 0 .4 0 .6.1z"/></svg>',
    claude:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="6" fill="#D97757"/><text x="12" y="15.5" text-anchor="middle" fill="#fff" font-size="8" font-family="Arial" font-weight="700">C</text></svg>',
    gemini:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="6" fill="#8E75B2"/><path fill="#fff" d="M12 4l1.8 5.2L19 11l-5.2 1.8L12 18l-1.8-5.2L5 11l5.2-1.8L12 4z"/></svg>',
    youtube:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="6" fill="#FF0000"/><path fill="#fff" d="M10 8.5v7l6-3.5-6-3.5z"/></svg>',
    spotify:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#1DB954"/><path fill="#111" d="M7.5 14.8c2.8-1 6.4-.8 8.8.5.3.2.7 0 .8-.3.2-.3 0-.7-.3-.8-2.7-1.4-6.6-1.7-9.8-.5-.4.1-.5.5-.3.8.1.2.5.4.8.3zm-.4-2.5c3.2-1.1 7.4-.9 10.3.7.4.2.8.1 1-.3.2-.4.1-.8-.3-1-3.3-1.8-8-2.1-11.5-.8-.4.2-.6.6-.4 1 .1.3.5.5.9.4zm-.5-2.6c3.7-1.2 8.7-1 12.1.8.4.3 1 .1 1.2-.3.3-.4.1-1-.3-1.2-3.8-2-9.3-2.3-13.5-.9-.5.2-.7.7-.5 1.1.1.4.6.6 1 .5z"/></svg>',
    netflix:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="4" fill="#111"/><path fill="#E50914" d="M8 4h2.8l4.4 12.2V4H18v16h-2.8L10.8 7.8V20H8V4z"/></svg>',
    github:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="6" fill="#24292F"/><path fill="#fff" d="M12 4.5c-4 0-7.2 3.2-7.2 7.2 0 3.2 2.1 5.9 5 6.8.4.1.5-.2.5-.4v-1.4c-2 .4-2.5-.9-2.5-.9-.3-.8-.8-1-.8-1-.7-.5.1-.5.1-.5.7.1 1.1.8 1.1.8.6 1.1 1.7.8 2.1.6.1-.5.3-.8.5-1-1.6-.2-3.3-.8-3.3-3.6 0-.8.3-1.5.8-2-.1-.2-.3-.9.1-1.9 0 0 .6-.2 2.1.8.6-.2 1.2-.2 1.8-.2s1.2.1 1.8.2c1.4-1 2.1-.8 2.1-.8.4 1 .2 1.7.1 1.9.5.5.8 1.2.8 2 0 2.8-1.7 3.4-3.3 3.6.3.3.6.7.6 1.4v2.1c0 .2.1.5.5.4 2.9-.9 5-3.6 5-6.8 0-4-3.2-7.2-7.2-7.2z"/></svg>',
    notion:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="4" fill="#fff" stroke="#111" stroke-width="1"/><path fill="#111" d="M8 7h7.5c.5 0 .9.2 1.1.6L18 11v6.5c0 .8-.7 1.5-1.5 1.5H8c-.8 0-1.5-.7-1.5-1.5v-9C6.5 7.7 7.2 7 8 7zm1.5 2v8h6.2l-1.3-2.2H11V9h-1.5z"/></svg>',
    drive:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#1FA463" d="M4 16.5 8.5 8h3L5.5 18H2l2-1.5z"/><path fill="#FFBA00" d="M12.5 8h3L21 18h-3.5L12.5 8z"/><path fill="#4285F4" d="m8.5 18 2-3.5h7l-2 3.5H8.5z"/></svg>',
    onedrive:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="6" fill="#0078D4"/><path fill="#fff" d="M8.5 15.5c-1.9 0-3.5-1.5-3.5-3.4 0-1.6 1.1-3 2.6-3.3.5-1.8 2.1-3.1 4-3.1 1.7 0 3.2 1 3.8 2.5 1.7.3 3 1.8 3 3.6 0 2-1.6 3.7-3.6 3.7H8.5z"/></svg>',
  };

  const api = window.mailApi;
  let services = [];
  let connections = [];
  let activeService = null;
  let embedServiceId = null;

  const els = {
    hub: document.getElementById("hub"),
    grid: document.getElementById("hub-grid"),
    search: document.getElementById("hub-search"),
    service: document.getElementById("hub-service"),
    embed: document.getElementById("hub-embed"),
    embedFrame: document.getElementById("hub-embed-frame"),
    embedTitle: document.getElementById("hub-embed-title"),
    embedHowto: document.getElementById("hub-embed-howto"),
    mail: document.getElementById("mail-workspace"),
  };

  function toast(msg) {
    const text = String(msg ?? "").trim();
    if (!text) return;
    let el = document.getElementById("hub-local-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "hub-local-toast";
      el.className = "hub-local-toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      el.hidden = true;
    }, 3200);
    try {
      window.top?.showMySpaceToast?.(text);
    } catch {
    }
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function hideAll() {
    if (els.hub) els.hub.hidden = true;
    if (els.service) els.service.hidden = true;
    if (els.embed) els.embed.hidden = true;
    if (els.mail) els.mail.hidden = true;
  }

  function showHub() {
    try {
      window.MailWorkspace?.leaveToHub?.();
    } catch {
    }
    hideAll();
    if (els.hub) els.hub.hidden = false;
    renderCatalog();
  }

  function showMail() {
    hideAll();
    if (els.mail) els.mail.hidden = false;
    try {
      if (typeof window.MailWorkspace?.enter === "function") {
        window.MailWorkspace.enter();
      } else {
        const setup = document.getElementById("mail-setup");
        const client = document.getElementById("mail-client");
        if (setup) setup.hidden = false;
        if (client) client.hidden = true;
      }
    } catch (err) {
      toast(err?.message || "Could not open Mail");
    }
  }

  function connectionFor(serviceId) {
    return connections.find((c) => c.serviceId === serviceId) || null;
  }

  function destroyEmbedFrame() {
    if (!els.embedFrame) return;
    els.embedFrame.innerHTML = "";
  }

  function setHowto(text) {
    if (!els.embedHowto) return;
    const t = String(text || "").trim();
    if (!t) {
      els.embedHowto.hidden = true;
      els.embedHowto.textContent = "";
      return;
    }
    els.embedHowto.hidden = false;
    els.embedHowto.textContent = t;
  }

  async function markConnected(service) {
    try {
      await api.hubEnsure?.(service.id);
      await refreshConnections();
    } catch {
    }
  }

  function showOpenedPanel(service, meta = {}) {
    hideAll();
    if (!els.embed || !els.embedFrame) {
      showHub();
      return;
    }
    embedServiceId = service.id;
    activeService = service;
    els.embed.hidden = false;
    if (els.embedTitle) els.embedTitle.textContent = service.name;
    setHowto(meta.howto || service.howto || "");
    destroyEmbedFrame();
    els.embedFrame.innerHTML = `<div class="hub-opened">
      <h2>${escapeHtml(service.name)} opened in My Space</h2>
      <p>Use the new tab in the top bar to sign in and use the app — everything stays inside My Space.</p>
      <div class="hub-service-actions">
        <button type="button" class="mail-btn mail-btn-primary" id="hub-reopen">Open again</button>
        <button type="button" class="mail-btn" id="hub-opened-back">Back to catalog</button>
      </div>
    </div>`;
    els.embedFrame.querySelector("#hub-reopen")?.addEventListener("click", () => openWorkspace(service));
    els.embedFrame.querySelector("#hub-opened-back")?.addEventListener("click", showHub);
  }

  let opening = false;

  async function openWorkspace(service, options = {}) {
    if (!service?.id || opening) return;
    opening = true;
    try {
      await markConnected(service);
      let urlOverride = null;
      if (service.id === "gmail" && options.messageId) {
        urlOverride = `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(options.messageId)}`;
      }
      const opts = urlOverride ? { url: urlOverride } : {};
      const res = api.hubOpenInShell
        ? await api.hubOpenInShell(service.id, opts)
        : await api.invoke?.("hub.openInShell", { serviceId: service.id, ...opts });
      if (!res?.ok) {
        toast(res?.error || "Could not open app — restart My Space");
        showHub();
        return;
      }
      showHub();
      toast(`${service.name} opened in My Space`);
    } catch (err) {
      toast(err?.message || "Could not open app");
      showHub();
    } finally {
      opening = false;
    }
  }

  async function openFromNotification(route = {}) {
    try {
      if (!services.length) {
        const cat = await api?.hubCatalog?.();
        services = cat?.services || [];
      }
      await refreshConnections();
      const gmail = services.find((s) => s.id === "gmail");
      if (!gmail) {
        toast("Gmail is not in Connect");
        return;
      }
      await openWorkspace(gmail, {
        messageId: route && typeof route === "object" ? route.messageId || null : null,
        accountId: route && typeof route === "object" ? route.accountId || null : null,
      });
    } catch (err) {
      toast(err?.message || "Could not open mail");
    }
  }

  function renderCatalog() {
    if (!els.grid) return;
    const q = String(els.search?.value || "").trim().toLowerCase();
    const byCat = new Map();
    for (const s of services) {
      if (q && !`${s.name} ${s.description} ${s.categoryLabel}`.toLowerCase().includes(q)) continue;
      const key = s.category || "other";
      if (!byCat.has(key)) byCat.set(key, { label: s.categoryLabel || key, items: [] });
      byCat.get(key).items.push(s);
    }

    const order = ["browser", "mail", "messaging", "social", "ai", "media", "tools"];
    const keys = [...byCat.keys()].sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

    els.grid.innerHTML =
      keys.length === 0
        ? `<div class="hub-opened"><h2>${escapeHtml(tt("service.connect.noApps"))}</h2><p>${escapeHtml(tt("service.connect.noAppsHint"))}</p></div>`
        : keys
      .map((key) => {
        const group = byCat.get(key);
        return `<section class="hub-section">
          <h2>${escapeHtml(group.label)}</h2>
          <div class="hub-cards">
            ${group.items
              .map((s) => {
                const conn = connectionFor(s.id);
                return `<button type="button" class="hub-card${conn ? " is-connected" : ""}" data-service="${escapeHtml(s.id)}">
                  <span class="hub-logo" style="--hub-color:${escapeHtml(s.color)}">${LOGOS[s.logo] || ""}</span>
                  <span class="hub-card-name">${escapeHtml(s.name)}</span>
                  <span class="hub-card-desc">${escapeHtml(s.description)}</span>
                  ${conn ? `<span class="hub-badge">${escapeHtml(tt("service.connect.connected"))}</span>` : ""}
                </button>`;
              })
              .join("")}
          </div>
        </section>`;
      })
      .join("");
  }

  function openService(serviceId) {
    try {
      const id = String(serviceId || "").trim();
      const service = services.find((s) => s.id === id);
      if (!service) {
        toast(`Unknown app: ${id || "(empty)"}`);
        return;
      }
      openWorkspace(service);
    } catch (err) {
      toast(err?.message || "Could not open app");
    }
  }

  async function refreshConnections() {
    const res = await api.hubList?.();
    connections = res?.connections || [];
  }

  async function boot() {
    try {
      if (!api?.hubCatalog) {
        toast("Connect API missing — restart My Space");
      }
      const cat = await api?.hubCatalog?.();
      services = cat?.services || [];
      if (!services.length) {
        toast("Connect catalog empty — restart My Space");
      }
      await refreshConnections();
      showHub();
      if (els.hub) els.hub.hidden = false;
      if (els.embed) els.embed.hidden = true;
      if (els.service) els.service.hidden = true;
      if (els.mail) els.mail.hidden = true;
      renderCatalog();
    } catch (err) {
      toast(err?.message || "Connect failed to start");
      showHub();
      renderCatalog();
    }
  }

  els.grid?.addEventListener("click", (e) => {
    const btn = e.target?.closest?.("[data-service]");
    if (!btn) return;
    e.preventDefault();
    openService(btn.getAttribute("data-service"));
  });

  els.search?.addEventListener("input", renderCatalog);

  document.getElementById("hub-embed-back")?.addEventListener("click", () => {
    destroyEmbedFrame();
    setHowto("");
    showHub();
  });
  document.getElementById("hub-embed-reload")?.addEventListener("click", () => {
    if (activeService) openWorkspace(activeService);
  });
  document.getElementById("hub-embed-browser")?.addEventListener("click", async () => {
    if (embedServiceId) await api.hubOpenExternal?.(embedServiceId);
  });

  window.MySpaceConnectHub = {
    show: showHub,
    showMail,
    refreshConnections,
    openEmbedded: openWorkspace,
    openFromNotification,
  };

  window.addEventListener("myspace-i18n-applied", () => renderCatalog());
  window.addEventListener("myspace-i18n-ready", () => renderCatalog());

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
