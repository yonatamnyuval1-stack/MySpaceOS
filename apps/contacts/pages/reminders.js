window.ContactsPages = window.ContactsPages || {};

window.ContactsPages.reminders = (function () {
  const { escapeHtml, invoke, formatBirthday } = window.Contacts;
  const page = document.getElementById("page-reminders");

  async function scan() {
    page.classList.add("loading");
    try {
      const [upcoming, check] = await Promise.all([
        invoke("reminders.upcoming"),
        invoke("reminders.check"),
      ]);
      render(upcoming.upcoming || [], check.triggered || []);
    } finally {
      page.classList.remove("loading");
    }
  }

  function render(upcoming, triggered) {
    const trigEl = page.querySelector("#rem-triggered");
    if (triggered.length) {
      trigEl.hidden = false;
      trigEl.innerHTML = `<strong>Just triggered</strong>${triggered.map((t) => `<div class="rem-hit">${escapeHtml(t.name)} — ${escapeHtml(t.title || t.type)}</div>`).join("")}`;
    } else {
      trigEl.hidden = true;
    }

    const list = page.querySelector("#rem-list");
    const bdays = upcoming.filter((u) => u.type === "birthday");
    const rems = upcoming.filter((u) => u.type === "reminder");

    let html = "";
    if (bdays.length) {
      html += `<h3 class="section-title">🎂 Upcoming birthdays</h3><div class="rem-grid">${bdays
        .map(
          (b) => `<div class="rem-card"><span>${escapeHtml(b.icon)} ${escapeHtml(b.name)}</span><span class="muted">${b.daysUntil === 0 ? "Today!" : `In ${b.daysUntil} days`} · ${formatBirthday(b.date)}</span></div>`
        )
        .join("")}</div>`;
    }
    if (rems.length) {
      html += `<h3 class="section-title">🔔 Reminders</h3><div class="rem-grid">${rems
        .map(
          (r) => `<div class="rem-card"><span>${escapeHtml(r.icon)} ${escapeHtml(r.name)}</span><span>${escapeHtml(r.title)}</span><span class="muted">${escapeHtml(r.date)} ${escapeHtml(r.time || "")} · ${escapeHtml(r.repeat)}</span></div>`
        )
        .join("")}</div>`;
    }
    if (!html) html = `<p class="muted empty-msg">No upcoming reminders. Add reminders on a contact profile.</p>`;
    list.innerHTML = html;
  }

  function bind() {
    page.querySelector("#btn-check-rem")?.addEventListener("click", scan);
  }

  return { id: "reminders", page, scan, bind };
})();
