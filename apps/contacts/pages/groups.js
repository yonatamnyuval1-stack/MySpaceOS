window.ContactsPages = window.ContactsPages || {};

window.ContactsPages.groups = (function () {
  const { escapeHtml, uid } = window.Contacts;
  const page = document.getElementById("page-groups");
  const DEFAULT_IDS = new Set(["family", "friends", "work", "other"]);
  let data = { groups: [], contacts: [] };

  async function scan() {
    data = await window.ContactsStorage.load();
    render();
  }

  function render() {
    page.innerHTML = `
      <p class="muted page-hint">Organize contacts into groups — Family, Work, Friends…</p>
      <div class="groups-list" id="groups-list"></div>
      <form class="card-panel group-add-form" id="group-add-form">
        <strong>Add group</strong>
        <div class="hold-row">
          <input type="text" id="new-grp-icon" class="field-input grp-icon-in" value="📁" maxlength="4" />
          <input type="text" id="new-grp-name" class="field-input" placeholder="Group name" required />
          <input type="color" id="new-grp-color" value="#8b9dc3" />
          <button type="submit" class="btn btn-primary">Add</button>
        </div>
      </form>`;

    const list = page.querySelector("#groups-list");
    list.innerHTML = data.groups
      .map((g) => {
        const count = data.contacts.filter((c) => c.groupId === g.id).length;
        return `<div class="group-row card-panel" data-id="${escapeHtml(g.id)}" style="--grp-color:${g.color}">
          <span class="group-icon">${escapeHtml(g.icon)}</span>
          <input type="text" class="field-input grp-name" value="${escapeHtml(g.name)}" />
          <input type="text" class="field-input grp-icon-in" value="${escapeHtml(g.icon)}" maxlength="4" />
          <input type="color" class="grp-color" value="${escapeHtml(g.color)}" />
          <span class="muted">${count} contacts</span>
          <button type="button" class="btn btn-ghost btn-sm grp-save">Save</button>
          ${!DEFAULT_IDS.has(g.id) ? `<button type="button" class="btn btn-ghost btn-sm grp-del">Delete</button>` : ""}
        </div>`;
      })
      .join("");

    list.querySelectorAll(".grp-save").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const row = btn.closest(".group-row");
        const id = row.dataset.id;
        const g = data.groups.find((x) => x.id === id);
        if (!g) return;
        g.name = row.querySelector(".grp-name").value.trim() || g.name;
        g.icon = row.querySelector(".grp-icon-in").value.trim() || g.icon;
        g.color = row.querySelector(".grp-color").value;
        await window.ContactsStorage.save(data);
        scan();
      });
    });

    list.querySelectorAll(".grp-del").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const row = btn.closest(".group-row");
        if (!confirm("Delete group? Contacts move to Other.")) return;
        const id = row.dataset.id;
        data.groups = data.groups.filter((g) => g.id !== id);
        data.contacts.forEach((c) => {
          if (c.groupId === id) c.groupId = "other";
        });
        await window.ContactsStorage.save(data);
        scan();
      });
    });

    page.querySelector("#group-add-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = page.querySelector("#new-grp-name").value.trim();
      if (!name) return;
      data.groups.push({
        id: uid("grp"),
        name,
        icon: page.querySelector("#new-grp-icon").value.trim() || "📁",
        color: page.querySelector("#new-grp-color").value,
      });
      await window.ContactsStorage.save(data);
      scan();
    });
  }

  function bind() {}

  return { id: "groups", page, scan, bind };
})();
