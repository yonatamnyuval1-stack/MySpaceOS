(function () {
  const PAGE_META = {
    browse: { title: "Contacts", subtitle: "People: profiles, phone, email & reminders" },
    reminders: { title: "Reminders", subtitle: "Birthdays & scheduled notifications" },
    groups: { title: "Groups", subtitle: "Organize your contacts" },
  };

  const pages = [window.ContactsPages.browse, window.ContactsPages.reminders, window.ContactsPages.groups];

  const ui = {
    nav: document.getElementById("main-nav"),
    groupNav: document.getElementById("group-nav"),
    title: document.getElementById("page-title"),
    subtitle: document.getElementById("page-subtitle"),
    brandSub: document.getElementById("brand-sub"),
    topbarActions: document.getElementById("topbar-actions"),
    btnAdd: document.getElementById("btn-add-contact"),
    btnExport: document.getElementById("btn-export"),
    btnImport: document.getElementById("btn-import"),
  };

  let activePage = pages[0];

  function setPage(pageId) {
    const next = pages.find((p) => p.id === pageId) || pages[0];
    activePage = next;

    pages.forEach((p) => {
      const on = p.id === next.id;
      p.page.hidden = !on;
      p.page.classList.toggle("active", on);
    });

    ui.nav.querySelectorAll(".nav-item[data-page]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.page === next.id);
    });

    const meta = PAGE_META[next.id] || PAGE_META.browse;
    ui.title.textContent = meta.title;
    ui.subtitle.textContent = meta.subtitle;
    ui.brandSub.textContent = meta.title;

    ui.topbarActions?.classList.toggle("hidden", next.id !== "browse");
    ui.groupNav?.classList.toggle("hidden", next.id !== "browse");

    if (next.scan) next.scan();
  }

  async function openContact(id) {
    setPage("browse");
    const browse = window.ContactsPages?.browse;
    if (!browse?.openEditor || !id) return;
    if (browse.scan) await browse.scan();
    browse.openEditor(id);
  }

  ui.nav.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-item[data-page]");
    if (!btn || btn.dataset.page === "app-settings") return;
    setPage(btn.dataset.page);
  });

  async function loadReminderSettings() {
    const data = await window.ContactsStorage.load();
    const s = data.settings || {};
    document.querySelector("#set-bday-time").value = s.birthdayReminderTime || "09:00";
    document.querySelector("#set-bday-on").checked = s.birthdayReminders !== false;
  }

  document.querySelector("#btn-save-settings")?.addEventListener("click", async () => {
    const data = await window.ContactsStorage.load();
    data.settings = data.settings || {};
    data.settings.birthdayReminderTime = document.querySelector("#set-bday-time").value || "09:00";
    data.settings.birthdayReminders = document.querySelector("#set-bday-on").checked;
    await window.ContactsStorage.save(data);
  });

  pages.forEach((p) => {
    if (p.bind) p.bind(ui);
  });

  loadReminderSettings();
  setPage("browse");
  window.ContactsApp = { setPage, openContact };

  if (window.Link) {
    window.Link.onCommand("open", async (args) => {
      const id = String(args?.id || "").trim();
      if (!id) return { ok: false, error: "Contact id required" };
      setPage("people");
      await openContact(id);
      return { ok: true };
    });
  }
})();