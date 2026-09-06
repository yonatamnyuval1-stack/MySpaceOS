(function () {
  let selectedProgram = null;
  let activeTab = "installed";

  function programTile(program) {
    const icon = program.iconData
      ? `<img src="${program.iconData}" alt="" />`
      : `<span class="picker-fallback">📦</span>`;
    return `
      <button type="button" class="picker-tile" data-target="${encodeURIComponent(program.paths[0])}">
        <span class="picker-icon">${icon}</span>
        <span class="picker-name">${program.name}</span>
      </button>
    `;
  }

  function blockExternalInPreview() {
    if (!window.MySpaceDesktop?.isFullDesktop()) {
      alert(
        "Programs (.exe) only work in the desktop app.\n\n" +
          "Close the browser tab.\n" +
          "Use only the window opened by open.bat.\n\n" +
          "Websites still work in preview."
      );
      return true;
    }
    return false;
  }

  function open({ onAdd, onCancel, defaultTab = "installed" }) {
    const hasNative = Boolean(window.mySpace?.scanInstalledApps);
    activeTab = defaultTab;
    selectedProgram = null;

    const tabClass = (name) => (name === defaultTab ? " active" : "");
    const panelClass = (name) => (name === defaultTab ? "" : " hidden");

    window.MySpaceModals.open({
      title: "Add to desktop",
      wide: true,
      bodyHtml: `
        <div class="picker-tabs">
          <button type="button" class="picker-tab${tabClass("installed")}" data-tab="installed">Installed programs</button>
          <button type="button" class="picker-tab${tabClass("browse")}" data-tab="browse">Choose file…</button>
          <button type="button" class="picker-tab${tabClass("website")}" data-tab="website">Website</button>
        </div>
        <div class="picker-panel${panelClass("installed")}" id="picker-panel-installed">
          ${
            hasNative
              ? `<input type="search" id="picker-search" class="field-input picker-search" placeholder="Search programs…" />
                 <div class="picker-status" id="picker-status">Loading programs from Windows…</div>
                 <div class="picker-grid" id="picker-grid"></div>`
              : `<p class="picker-note">Installed programs need open.bat. Use the Website tab here.</p>`
          }
        </div>
        <div class="picker-panel${panelClass("browse")}" id="picker-panel-browse">
          ${
            hasNative
              ? `<p class="picker-note">Pick your .exe file (for apps you built).</p>
                 <button type="button" class="btn btn-primary" id="picker-browse-btn">Browse for program…</button>
                 <div id="picker-browse-result" class="picker-browse-result hidden"></div>`
              : `<p class="picker-note">To add programs, close the browser and use open.bat only.</p>`
          }
        </div>
        <div class="picker-panel${panelClass("website")}" id="picker-panel-website">
          <label class="field">
            <span class="field-label">Website name</span>
            <input id="picker-web-name" class="field-input" placeholder="GitHub" />
          </label>
          <label class="field">
            <span class="field-label">URL</span>
            <input id="picker-web-url" class="field-input" placeholder="https://github.com" />
          </label>
        </div>
      `,
      footerButtons: [
        { label: "Cancel", onClick: () => { onCancel?.(); return false; } },
        {
          label: "Add to desktop",
          primary: true,
          onClick: () => {
            if (activeTab === "website") {
              const name = document.getElementById("picker-web-name").value.trim();
              const url = document.getElementById("picker-web-url").value.trim();
              if (!name || !url) {
                alert("Name and URL are required.");
                return false;
              }
              onAdd({ name, type: "url", url });
              return;
            }

            if (blockExternalInPreview()) return false;

            if (activeTab === "browse") {
              if (!selectedProgram) {
                alert("Choose a program first.");
                return false;
              }
              onAdd({
                name: selectedProgram.name,
                type: "external",
                paths: selectedProgram.paths,
                iconData: selectedProgram.iconData,
              });
              return;
            }

            if (!selectedProgram) {
              alert("Select a program from the list.");
              return false;
            }
            onAdd({
              name: selectedProgram.name,
              type: "external",
              paths: selectedProgram.paths,
              iconData: selectedProgram.iconData,
            });
          },
        },
      ],
    });

    setupPickerTabs();
    if (hasNative) {
      loadInstalledPrograms();
      setupBrowseNative();
    }
  }

  function setupPickerTabs() {
    const panels = {
      installed: document.getElementById("picker-panel-installed"),
      browse: document.getElementById("picker-panel-browse"),
      website: document.getElementById("picker-panel-website"),
    };

    document.querySelectorAll(".picker-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        activeTab = tab.dataset.tab;
        document.querySelectorAll(".picker-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        Object.entries(panels).forEach(([key, panel]) => {
          panel?.classList.toggle("hidden", key !== activeTab);
        });
        selectedProgram = null;
      });
    });
  }

  async function loadInstalledPrograms() {
    const grid = document.getElementById("picker-grid");
    const status = document.getElementById("picker-status");
    const search = document.getElementById("picker-search");

    let programs = [];
    try {
      programs = await window.mySpace.scanInstalledApps();
      status.textContent = `${programs.length} programs found`;
    } catch {
      status.textContent = "Could not load programs.";
      return;
    }

    function render(filter = "") {
      const q = filter.trim().toLowerCase();
      const list = q
        ? programs.filter((p) => p.name.toLowerCase().includes(q) || p.paths[0].toLowerCase().includes(q))
        : programs;

      grid.innerHTML = list.map(programTile).join("") || `<p class="picker-note">No matches.</p>`;

      grid.querySelectorAll(".picker-tile").forEach((btn) => {
        btn.addEventListener("click", () => {
          grid.querySelectorAll(".picker-tile").forEach((b) => b.classList.remove("selected"));
          btn.classList.add("selected");
          const target = decodeURIComponent(btn.dataset.target);
          selectedProgram = programs.find((p) => p.paths[0] === target);
        });
      });
    }

    render();
    search?.addEventListener("input", () => render(search.value));
  }

  function setupBrowseNative() {
    const resultBox = document.getElementById("picker-browse-result");
    document.getElementById("picker-browse-btn")?.addEventListener("click", async () => {
      const picked = await window.mySpace.pickExecutable();
      if (picked.canceled) return;
      selectedProgram = picked;
      resultBox.classList.remove("hidden");
      resultBox.innerHTML = `
        <div class="picker-browse-card">
          ${picked.iconData ? `<img src="${picked.iconData}" alt="" />` : ""}
          <div>
            <strong>${picked.name}</strong>
            <p>${picked.paths[0]}</p>
          </div>
        </div>
      `;
    });
  }

  window.MySpaceAppPicker = { open };
})();