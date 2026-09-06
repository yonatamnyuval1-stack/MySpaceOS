(function () {
  const CATEGORIES = [
    { id: "general", label: "General" },
    { id: "backgrounds", label: "Backgrounds" },
    { id: "apps", label: "Apps" },
    { id: "languages-time", label: "Languages and time" },
    { id: "tools", label: "Tools" },
  ];

  const SETTINGS_ICON_GRAY =
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
        <path fill="#9aa4b2" d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.2 7.2 0 0 0-1.62-.94l-.36-2.54A.48.48 0 0 0 14 2h-4a.48.48 0 0 0-.48.42l-.36 2.54c-.59.24-1.13.55-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.65 8.87a.49.49 0 0 0 .12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.77 14.5a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.3.59.22l2.39-.96c.5.39 1.04.71 1.62.94l.36 2.54c.05.24.25.42.48.42h4c.24 0 .44-.18.48-.42l.36-2.54c.59-.24 1.13-.55 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/>
      </svg>`
    );

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function emptyPane() {
    return el("div", "settings-pane settings-pane--empty");
  }

  function createFormKit(pane) {
    function section(title) {
      const sec = el("section", "appset-section");
      sec.appendChild(el("h3", "appset-section-title", title));
      const body = el("div", "appset-section-body");
      sec.appendChild(body);
      pane.appendChild(sec);
      return body;
    }

    function row(label, hint, control) {
      const r = el("div", "appset-row");
      const text = el("div", "appset-row-text");
      text.appendChild(el("div", "appset-row-label", label));
      if (hint) text.appendChild(el("div", "appset-row-hint", hint));
      r.appendChild(text);
      if (control) r.appendChild(control);
      return r;
    }

    function toggle(on, onChange) {
      const btn = el("button", `appset-toggle ${on ? "is-on" : "is-off"}`);
      btn.type = "button";
      btn.setAttribute("role", "switch");
      btn.setAttribute("aria-checked", on ? "true" : "false");
      btn.innerHTML = `<span class="appset-toggle-track"><span class="appset-toggle-thumb"></span></span>`;
      btn.addEventListener("click", () => {
        const next = btn.classList.contains("is-off");
        btn.classList.toggle("is-on", next);
        btn.classList.toggle("is-off", !next);
        btn.setAttribute("aria-checked", next ? "true" : "false");
        onChange?.(next);
      });
      return btn;
    }

    function select(options, value, onChange) {
      const wrap = el("div", "appset-select-wrap");
      const sel = document.createElement("select");
      sel.className = "appset-select";
      options.forEach((opt) => {
        const o = document.createElement("option");
        o.value = opt.value;
        o.textContent = opt.label;
        if (opt.value === value) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener("change", () => onChange?.(sel.value));
      wrap.appendChild(sel);
      return wrap;
    }

    function textInput(value, placeholder, onCommit) {
      const input = document.createElement("input");
      input.type = "text";
      input.className = "appset-input";
      input.value = value || "";
      input.placeholder = placeholder || "";
      input.addEventListener("change", () => onCommit?.(input.value));
      return input;
    }

    function actionBtn(label, kind, onClick) {
      const btn = el("button", `appset-action ${kind ? `appset-action--${kind}` : ""}`, label);
      btn.type = "button";
      btn.addEventListener("click", onClick);
      return btn;
    }

    return { section, row, toggle, select, textInput, actionBtn };
  }

  function settingsHeader({ title, meta, badgeText, badgeClass, iconSvg }) {
    const header = el("header", "appset-header");
    const logo = el("div", "appset-logo appset-logo--settings");
    if (iconSvg) {
      logo.innerHTML = iconSvg;
    } else {
      logo.textContent = "⚙";
    }
    header.appendChild(logo);

    const titleBlock = el("div", "appset-title-block");
    titleBlock.appendChild(el("h2", "appset-name", title));
    titleBlock.appendChild(el("p", "appset-meta", meta));
    header.appendChild(titleBlock);

    if (badgeText) {
      const badge = el("span", `appset-status ${badgeClass || "is-visible"}`, badgeText);
      badge.setAttribute("aria-hidden", "true");
      header.appendChild(badge);
    }
    return header;
  }

  function patchSettings(patch) {
    window.MySpaceConfig?.updateSettings?.(patch);
    if (typeof window.applyMySpaceHeader === "function") {
      window.applyMySpaceHeader();
    } else {
      const titleEl = document.getElementById("taskbar-title");
      const subEl = document.getElementById("welcome-subtitle");
      const s = window.MySpaceConfig?.getSettings?.() || {};
      if (titleEl && s.title) titleEl.textContent = s.title;
      if (subEl && s.subtitle != null) subEl.textContent = s.subtitle;
      document.title = s.title || document.title;
    }
  }

  function buildGeneralPane() {
    const pane = el("div", "settings-pane settings-pane--general");
    const s = () => window.MySpaceConfig?.getSettings?.() || {};
    const cur = s();
    const kit = createFormKit(pane);

    pane.appendChild(
      settingsHeader({
        title: "General",
        meta: "Space identity, desktop behavior, and everyday defaults",
        badgeText: "System",
        badgeClass: "is-visible",
        iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#5b6b82" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`,
      })
    );

    const identity = kit.section("Space");
    identity.appendChild(
      kit.row(
        "Space name",
        "Shown in the taskbar and window title.",
        kit.textInput(cur.title || "My Space", "My Space", (v) => {
          const next = (v || "").trim() || "My Space";
          patchSettings({ title: next });
        })
      )
    );
    identity.appendChild(
      kit.row(
        "Tagline",
        "Short line under Welcome and related surfaces.",
        kit.textInput(cur.subtitle || "", "Your work environment…", (v) => {
          patchSettings({ subtitle: (v || "").trim() });
        })
      )
    );

    const desktop = kit.section("Desktop");
    desktop.appendChild(
      kit.row(
        "Show clock in taskbar",
        "Display the current date and time on the right of the taskbar.",
        kit.toggle(cur.showClock !== false, (on) => {
          patchSettings({ showClock: on });
          updateClockFromSettings();
        })
      )
    );
    desktop.appendChild(
      kit.row(
        "Show Welcome on startup",
        "Open the Welcome command center when My Space launches. Welcome is a startup screen, not a desktop app.",
        kit.toggle(cur.openWelcomeOnStart !== false, (on) => {
          patchSettings({ openWelcomeOnStart: on });
        })
      )
    );
    desktop.appendChild(
      kit.row(
        "Hot corners",
        "Move the cursor to screen corners: desktop, palette, Start, shortcuts.",
        kit.toggle(cur.hotCorners !== false, (on) => {
          patchSettings({ hotCorners: on });
          window.MySpaceHotCorners?.setEnabled?.(on);
        })
      )
    );
    desktop.appendChild(
      kit.row(
        "Focus hides other icons",
        "During Focus / Pomodoro work, show only Today and the active app on the desktop.",
        kit.toggle(cur.focusDesktopOnly !== false, (on) => {
          patchSettings({ focusDesktopOnly: on });
          window.__myspaceAiRefreshDesktop?.();
        })
      )
    );
    desktop.appendChild(
      kit.row(
        "Confirm before closing apps",
        "Ask for confirmation when closing an open app window.",
        kit.toggle(cur.confirmCloseApps !== false, (on) => {
          patchSettings({ confirmCloseApps: on });
        })
      )
    );

    const spaces = kit.section("Desktop spaces");
    const liveSpaces = () => window.MySpaceDesktopSpaces?.spaces?.() || window.MySpaceConfig?.getDesktopSpaces?.() || { spaces: [], activeId: "" };
    const pack = liveSpaces();
    const spaceRow = el("div", "appset-actions");
    pack.spaces.forEach((sp) => {
      const b = kit.actionBtn(
        (sp.id === pack.activeId ? "● " : "") + sp.name,
        sp.id === pack.activeId ? "primary" : "ghost",
        async () => {
          await window.MySpaceDesktopSpaces?.switchTo?.(sp.id);
          const next = liveSpaces();
          spaceRow.querySelectorAll("button[data-space-id]").forEach((btn) => {
            const id = btn.getAttribute("data-space-id");
            const active = id === next?.activeId;
            const name = next?.spaces?.find((x) => x.id === id)?.name || btn.dataset.spaceName || id;
            btn.classList.toggle("appset-action--primary", active);
            btn.classList.toggle("appset-action--ghost", !active);
            btn.textContent = (active ? "● " : "") + name;
          });
        }
      );
      b.dataset.spaceId = sp.id;
      b.dataset.spaceName = sp.name;
      spaceRow.appendChild(b);
    });
    spaces.appendChild(
      kit.row(
        "Active desktop",
        "Each My Space window has its own Study / Work / Play desktops (open apps stay with that window).",
        spaceRow
      )
    );

    const maintenance = kit.section("Maintenance");
    const resetWrap = el("div", "appset-actions");
    resetWrap.appendChild(
      kit.actionBtn("Reset icon positions", "danger", async () => {
        const ok = window.confirm("Reset all desktop icon positions to the default layout?");
        if (!ok) return;
        await window.MySpaceConfig?.resetPositions?.();
        window.__myspaceAiRefreshDesktop?.();
        window.showMySpaceToast?.("Desktop icon positions reset");
      })
    );
    maintenance.appendChild(
      kit.row(
        "Desktop layout",
        "Clear saved icon coordinates and rearrange apps automatically.",
        resetWrap
      )
    );

    const backupWrap = el("div", "appset-actions");
    backupWrap.appendChild(
      kit.actionBtn("Export backup", null, async () => {
        const res = await window.mySpace?.backup?.export?.();
        if (res?.ok) window.showMySpaceToast?.(res.message || "Backup exported");
        else if (res?.error && !/cancel/i.test(res.error)) {
          window.showMySpaceToast?.(res.error || "Export failed");
        }
      })
    );
    backupWrap.appendChild(
      kit.actionBtn("Restore backup", "danger", async () => {
        const ok = window.confirm(
          "Restore will replace your My Space data from a zip, then restart. Continue?"
        );
        if (!ok) return;
        const res = await window.mySpace?.backup?.import?.();
        if (res?.ok) window.showMySpaceToast?.(res.message || "Restoring…");
        else if (res?.error && !/cancel/i.test(res.error)) {
          window.showMySpaceToast?.(res.error || "Restore failed");
        }
      })
    );
    backupWrap.appendChild(
      kit.actionBtn("Open data folder", null, async () => {
        const res = await window.mySpace?.backup?.path?.();
        if (res?.ok) window.showMySpaceToast?.(res.message || "Opened data folder");
        else window.showMySpaceToast?.(res?.error || "Could not open folder");
      })
    );
    maintenance.appendChild(
      kit.row(
        "Backup & restore",
        "Export or restore the full userData archive (scripts, settings, app JSON). Shell: backup(export).",
        backupWrap
      )
    );

    const about = kit.section("About");
    const aboutGrid = el("div", "appset-about");
    [
      ["Product", "My Space"],
      ["Version", "0.1.0"],
      ["Type", "Desktop environment"],
    ].forEach(([k, v]) => {
      const item = el("div", "appset-about-item");
      item.appendChild(el("div", "appset-about-key", k));
      item.appendChild(el("div", "appset-about-val", v));
      aboutGrid.appendChild(item);
    });
    about.appendChild(aboutGrid);

    return pane;
  }

  function updateClockFromSettings() {
    const clockEl = document.getElementById("clock");
    if (!clockEl) return;
    const settings = window.MySpaceConfig?.getSettings?.() || {};
    if (settings.showClock === false) {
      clockEl.classList.add("hidden");
      clockEl.textContent = "";
      return;
    }
    clockEl.classList.remove("hidden");
    const locale = settings.locale || "en-US";
    const timeZone = settings.timezone || undefined;
    const hour12 = settings.timeFormat !== "24h";
    const now = new Date();
    try {
      clockEl.textContent = now.toLocaleString(locale, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: settings.showSeconds ? "2-digit" : undefined,
        hour12,
        timeZone,
      });
    } catch {
      clockEl.textContent = now.toLocaleString();
    }
  }

  function buildLanguagesTimePane() {
    const pane = el("div", "settings-pane settings-pane--languages");
    const s = () => window.MySpaceConfig?.getSettings?.() || {};
    const cur = s();
    const kit = createFormKit(pane);
    const systemTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

    pane.appendChild(
      settingsHeader({
        title: "Languages and time",
        meta: "Region, clock format, and how dates appear across My Space",
        badgeText: "Locale",
        badgeClass: "is-visible",
        iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#5b6b82" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>`,
      })
    );

    const language = kit.section("Language");
    language.appendChild(
      kit.row(
        "Display language",
        "Language used for menus and settings. Additional languages will appear here later.",
        kit.select(
          [{ value: "en", label: "English" }],
          cur.language || "en",
          (v) => patchSettings({ language: v })
        )
      )
    );
    language.appendChild(
      kit.row(
        "Region format",
        "Controls how dates and numbers are formatted.",
        kit.select(
          [
            { value: "en-US", label: "United States (en-US)" },
            { value: "en-GB", label: "United Kingdom (en-GB)" },
            { value: "he-IL", label: "Israel (he-IL)" },
            { value: "fr-FR", label: "France (fr-FR)" },
            { value: "de-DE", label: "Germany (de-DE)" },
            { value: "es-ES", label: "Spain (es-ES)" },
            { value: "ja-JP", label: "Japan (ja-JP)" },
          ],
          cur.locale || "en-US",
          (v) => {
            patchSettings({ locale: v });
            updateClockFromSettings();
          }
        )
      )
    );

    const time = kit.section("Time");
    const tzOptions = [
      { value: systemTz, label: `System default (${systemTz})` },
      { value: "UTC", label: "UTC" },
      { value: "America/New_York", label: "Eastern Time (New York)" },
      { value: "America/Los_Angeles", label: "Pacific Time (Los Angeles)" },
      { value: "Europe/London", label: "London" },
      { value: "Europe/Paris", label: "Paris" },
      { value: "Europe/Berlin", label: "Berlin" },
      { value: "Asia/Jerusalem", label: "Jerusalem" },
      { value: "Asia/Dubai", label: "Dubai" },
      { value: "Asia/Tokyo", label: "Tokyo" },
      { value: "Australia/Sydney", label: "Sydney" },
    ];
    const currentTz = cur.timezone || systemTz;
    if (!tzOptions.some((o) => o.value === currentTz)) {
      tzOptions.splice(1, 0, { value: currentTz, label: currentTz });
    }
    time.appendChild(
      kit.row(
        "Time zone",
        "Used for the taskbar clock and time-related displays.",
        kit.select(tzOptions, currentTz, (v) => {
          patchSettings({ timezone: v });
          updateClockFromSettings();
        })
      )
    );
    time.appendChild(
      kit.row(
        "Clock format",
        "12-hour (AM/PM) or 24-hour clock.",
        kit.select(
          [
            { value: "12h", label: "12-hour" },
            { value: "24h", label: "24-hour" },
          ],
          cur.timeFormat === "24h" ? "24h" : "12h",
          (v) => {
            patchSettings({ timeFormat: v });
            updateClockFromSettings();
          }
        )
      )
    );
    time.appendChild(
      kit.row(
        "Show seconds",
        "Include seconds in the taskbar clock.",
        kit.toggle(!!cur.showSeconds, (on) => {
          patchSettings({ showSeconds: on });
          updateClockFromSettings();
        })
      )
    );

    const calendar = kit.section("Calendar");
    calendar.appendChild(
      kit.row(
        "First day of week",
        "Preferred start day for calendars and weekly views.",
        kit.select(
          [
            { value: "sunday", label: "Sunday" },
            { value: "monday", label: "Monday" },
          ],
          cur.weekStartsOn === "monday" ? "monday" : "sunday",
          (v) => patchSettings({ weekStartsOn: v })
        )
      )
    );

    const preview = kit.section("Preview");
    const previewRow = el("div", "appset-row");
    const previewText = el("div", "appset-row-text");
    previewText.appendChild(el("div", "appset-row-label", "Current clock"));
    const previewHint = el("div", "appset-row-hint settings-locale-preview");
    previewHint.id = "settings-locale-preview";
    previewText.appendChild(previewHint);
    previewRow.appendChild(previewText);
    preview.appendChild(previewRow);

    function refreshPreview() {
      const settings = s();
      const locale = settings.locale || "en-US";
      const timeZone = settings.timezone || systemTz;
      const hour12 = settings.timeFormat !== "24h";
      try {
        previewHint.textContent = new Date().toLocaleString(locale, {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: settings.showSeconds ? "2-digit" : undefined,
          hour12,
          timeZone,
        });
      } catch {
        previewHint.textContent = new Date().toLocaleString();
      }
    }
    refreshPreview();
    const previewTimer = setInterval(() => {
      if (!pane.isConnected) {
        clearInterval(previewTimer);
        return;
      }
      refreshPreview();
    }, 1000);

    return pane;
  }

  function buildBackgroundsPane() {
    const pane = el("div", "settings-pane settings-pane--backgrounds");
    pane.appendChild(
      settingsHeader({
        title: "Backgrounds",
        meta: "Pick several wallpapers: My Space rotates them every 5 minutes",
        badgeText: "Desktop",
        badgeClass: "is-visible",
        iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#5b6b82" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 14l4-4 3 3 4-5 7 6"/></svg>`,
      })
    );

    const status = el("p", "settings-wallpaper-status");
    const grid = el("div", "settings-wallpaper-grid");

    function playlistIds() {
      const list = window.MySpaceWallpapers?.getPlaylist?.() || [];
      if (list.length) return list;
      const current = window.MySpaceWallpapers?.getCurrentId?.() || "gradient";
      return [current];
    }

    function paintStatus() {
      const selected = window.MySpaceWallpapers?.getPlaylist?.() || [];
      const n = selected.length;
      if (n >= 2) {
        status.textContent = `Rotating ${n} backgrounds every 5 minutes. Click to add or remove.`;
        status.classList.add("is-rotating");
      } else if (n === 1) {
        status.textContent = "1 wallpaper selected: pick at least one more to start rotation.";
        status.classList.remove("is-rotating");
      } else {
        status.textContent = "Select wallpapers to use. With 2 or more, they rotate every 5 minutes.";
        status.classList.remove("is-rotating");
      }
    }

    function paintCards() {
      const selected = new Set(playlistIds());
      const persisted = window.MySpaceWallpapers?.getPlaylist?.() || [];
      const selectedSet = persisted.length ? new Set(persisted) : selected;
      const currentId = window.MySpaceWallpapers?.getCurrentId?.() || "gradient";

      grid.querySelectorAll(".settings-wallpaper-card").forEach((card) => {
        const id = card.dataset.wallpaperId;
        card.classList.toggle("is-selected", selectedSet.has(id));
        card.classList.toggle("is-active", id === currentId);
        card.setAttribute("aria-pressed", selectedSet.has(id) ? "true" : "false");
      });
      paintStatus();
    }

    const all = window.MySpaceWallpapers?.list || [];
    const currentId = window.MySpaceWallpapers?.getCurrentId?.() || "gradient";
    const selectedNow = new Set(playlistIds());
    const ordered = [
      ...all.filter((w) => selectedNow.has(w.id) || w.id === currentId),
      ...all.filter((w) => !selectedNow.has(w.id) && w.id !== currentId),
    ];

    ordered.forEach((wp) => {
      const btn = el("button", "settings-wallpaper-card");
      btn.type = "button";
      btn.dataset.wallpaperId = wp.id;
      btn.title = wp.name;
      btn.setAttribute("aria-label", wp.name);
      btn.setAttribute("aria-pressed", "false");

      const preview = el("div", "settings-wallpaper-preview");
      window.MySpaceWallpapers.applyStyles(preview, wp);
      const mark = el("span", "settings-wallpaper-check", "✓");
      mark.setAttribute("aria-hidden", "true");
      preview.appendChild(mark);
      btn.appendChild(preview);

      const label = el("span", "settings-wallpaper-name", wp.name);
      btn.appendChild(label);

      btn.addEventListener("click", () => {
        window.MySpaceWallpapers?.togglePlaylist?.(wp.id);
        const persisted = window.MySpaceWallpapers?.getPlaylist?.() || [];
        if (!persisted.length) {
        }
        paintCards();
      });

      grid.appendChild(btn);
    });

    pane.appendChild(status);
    pane.appendChild(grid);
    paintCards();

    const onRotated = () => paintCards();
    window.addEventListener("myspace-wallpaper-rotated", onRotated);
    pane.addEventListener(
      "myspace-pane-dispose",
      () => window.removeEventListener("myspace-wallpaper-rotated", onRotated),
      { once: true }
    );

    return pane;
  }

  function buildToolRow(tool, onToggle) {
    const row = el("div", "settings-tool-row");
    row.dataset.tool = tool.name;

    const left = el("div", "settings-tool-left");
    left.appendChild(el("span", "settings-tool-name", tool.name));
    const tag = el(
      "span",
      `settings-tool-tag ${tool.active ? "is-active" : "is-inactive"}`,
      tool.active ? "active" : "inactive"
    );
    left.appendChild(tag);

    const btn = el(
      "button",
      `settings-tool-toggle ${tool.active ? "is-stop" : "is-start"}`,
      tool.active ? "stop" : "start"
    );
    btn.type = "button";
    btn.addEventListener("click", () => onToggle(tool, btn, tag, row));

    row.appendChild(left);
    row.appendChild(btn);
    return row;
  }

  function buildToolsPane() {
    const pane = el("div", "settings-pane settings-pane--tools");
    const list = el("div", "settings-tool-list");
    pane.appendChild(list);

    const status = el("div", "settings-tool-status");
    list.appendChild(status);

    async function refresh() {
      status.textContent = "Loading tools…";
      status.classList.remove("hidden");
      list.querySelectorAll(".settings-tool-row").forEach((n) => n.remove());

      if (!window.mySpace?.aiChat?.listTools) {
        status.textContent = "Tools API unavailable.";
        return;
      }

      try {
        const res = await window.mySpace.aiChat.listTools();
        if (!res?.ok) {
          status.textContent = res?.error || "Could not load tools.";
          return;
        }
        status.classList.add("hidden");
        const tools = Array.isArray(res.tools) ? res.tools : [];
        if (!tools.length) {
          status.textContent = "No tools registered.";
          status.classList.remove("hidden");
          return;
        }

        tools.forEach((tool) => {
          list.appendChild(
            buildToolRow(tool, async (t, btn, tag) => {
              const nextActive = !t.active;
              btn.disabled = true;
              try {
                const result = await window.mySpace.aiChat.setToolActive(t.name, nextActive);
                if (!result?.ok) throw new Error(result?.error || "Failed");
                t.active = nextActive;
                tag.textContent = nextActive ? "active" : "inactive";
                tag.classList.toggle("is-active", nextActive);
                tag.classList.toggle("is-inactive", !nextActive);
                btn.textContent = nextActive ? "stop" : "start";
                btn.classList.toggle("is-stop", nextActive);
                btn.classList.toggle("is-start", !nextActive);
              } catch (err) {
                window.showMySpaceToast?.(err.message || "Could not update tool");
              } finally {
                btn.disabled = false;
              }
            })
          );
        });
      } catch (err) {
        status.textContent = err.message || "Could not load tools.";
        status.classList.remove("hidden");
      }
    }

    refresh();
    return pane;
  }

  async function resolveAppIconSrc(app) {
    try {
      if (window.mySpace?.resolveAppIcon) {
        const resolved = await window.mySpace.resolveAppIcon(app);
        if (resolved) return resolved;
      }
    } catch {
    }
    return window.MySpaceIcons?.resolveIconFromConfig?.(app) || null;
  }

  function buildAppSettingsPane(app, ctx = {}) {
    const getLive = () =>
      window.MySpaceConfig?.getApps?.()?.find((a) => a.id === app.id) || app;

    const pane = el("div", "settings-pane settings-pane--app-settings");
    const live = getLive();
    const isHidden = !!live.hidden;

    const header = el("header", "appset-header");

    const logo = el("div", "appset-logo");
    const emoji = window.MySpaceIcons?.emojiFallback?.(live) || "📦";
    logo.textContent = emoji;
    header.appendChild(logo);

    resolveAppIconSrc(live).then((src) => {
      if (!src || !logo.isConnected) return;
      const img = document.createElement("img");
      img.src = src;
      img.alt = "";
      img.draggable = false;
      img.addEventListener("error", () => {
        logo.replaceChildren();
        logo.textContent = emoji;
      });
      logo.replaceChildren(img);
    });

    const titleBlock = el("div", "appset-title-block");
    titleBlock.appendChild(el("h2", "appset-name", live.name || live.id));
    const metaBits = [live.type, live.module, live.description].filter(Boolean);
    titleBlock.appendChild(
      el("p", "appset-meta", metaBits.slice(0, 2).join(" · ") || "Application")
    );
    header.appendChild(titleBlock);

    const statusBtn = el(
      "button",
      `appset-status ${isHidden ? "is-hidden" : "is-visible"}`,
      isHidden ? "Hidden" : "Visible"
    );
    statusBtn.type = "button";
    statusBtn.title = isHidden ? "Show on desktop" : "Hide from desktop";
    statusBtn.addEventListener("click", () => {
      const nextHidden = !getLive().hidden;
      window.MySpaceConfig?.setAppHidden?.(live.id, nextHidden);
      window.__myspaceAiRefreshDesktop?.();
      ctx.onOpenAppSettings?.(getLive());
    });
    header.appendChild(statusBtn);

    pane.appendChild(header);

    function section(title) {
      const sec = el("section", "appset-section");
      sec.appendChild(el("h3", "appset-section-title", title));
      const body = el("div", "appset-section-body");
      sec.appendChild(body);
      pane.appendChild(sec);
      return body;
    }

    function row(label, hint, control) {
      const r = el("div", "appset-row");
      const text = el("div", "appset-row-text");
      text.appendChild(el("div", "appset-row-label", label));
      if (hint) text.appendChild(el("div", "appset-row-hint", hint));
      r.appendChild(text);
      if (control) r.appendChild(control);
      return r;
    }

    function toggle(on, onChange) {
      const btn = el("button", `appset-toggle ${on ? "is-on" : "is-off"}`);
      btn.type = "button";
      btn.setAttribute("role", "switch");
      btn.setAttribute("aria-checked", on ? "true" : "false");
      btn.innerHTML = `<span class="appset-toggle-track"><span class="appset-toggle-thumb"></span></span>`;
      btn.addEventListener("click", () => {
        const next = btn.classList.contains("is-off");
        btn.classList.toggle("is-on", next);
        btn.classList.toggle("is-off", !next);
        btn.setAttribute("aria-checked", next ? "true" : "false");
        onChange?.(next);
      });
      return btn;
    }

    function select(options, value, onChange) {
      const wrap = el("div", "appset-select-wrap");
      const sel = document.createElement("select");
      sel.className = "appset-select";
      options.forEach((o) => {
        const opt = document.createElement("option");
        opt.value = o.value;
        opt.textContent = o.label;
        if (String(o.value) === String(value)) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener("change", () => onChange?.(sel.value));
      wrap.appendChild(sel);
      return wrap;
    }

    function textInput(value, placeholder, onCommit) {
      const input = document.createElement("input");
      input.type = "text";
      input.className = "appset-input";
      input.value = value || "";
      input.placeholder = placeholder || "";
      input.addEventListener("change", () => onCommit?.(input.value));
      return input;
    }

    function actionBtn(label, kind, onClick) {
      const btn = el("button", `appset-action ${kind ? `appset-action--${kind}` : ""}`, label);
      btn.type = "button";
      btn.addEventListener("click", onClick);
      return btn;
    }

    const prefsKey = `myspace-appset-${live.id}`;
    function loadPrefs() {
      try {
        return JSON.parse(localStorage.getItem(prefsKey) || "{}") || {};
      } catch {
        return {};
      }
    }
    function savePrefs(patch) {
      const next = { ...loadPrefs(), ...patch };
      localStorage.setItem(prefsKey, JSON.stringify(next));
      return next;
    }
    let prefs = loadPrefs();

    const desktop = section("Desktop");
    desktop.appendChild(
      row(
        "Show on desktop",
        "When hidden, the app is removed from the desktop and Start menu.",
        toggle(!isHidden, (on) => {
          window.MySpaceConfig?.setAppHidden?.(live.id, !on);
          window.__myspaceAiRefreshDesktop?.();
          ctx.onOpenAppSettings?.(getLive());
        })
      )
    );
    desktop.appendChild(
      row(
        "Show in Start menu",
        "Include this app in the Start menu list.",
        toggle(prefs.startMenu !== false, (on) => {
          prefs = savePrefs({ startMenu: on });
        })
      )
    );
    desktop.appendChild(
      row(
        "Keep icon position",
        "Remember where you placed this icon on the desktop.",
        toggle(prefs.keepPosition !== false, (on) => {
          prefs = savePrefs({ keepPosition: on });
        })
      )
    );

    const launch = section("Launch");
    launch.appendChild(
      row(
        "Open at startup",
        "Launch this app automatically when My Space starts.",
        toggle(!!prefs.openAtStartup, (on) => {
          prefs = savePrefs({ openAtStartup: on });
        })
      )
    );
    launch.appendChild(
      row(
        "Restore last page",
        "Return to the last opened screen inside the app.",
        toggle(prefs.restorePage !== false, (on) => {
          prefs = savePrefs({ restorePage: on });
        })
      )
    );
    launch.appendChild(
      row(
        "Confirm before close",
        "Ask before closing this app window.",
        toggle(!!prefs.confirmClose, (on) => {
          prefs = savePrefs({ confirmClose: on });
        })
      )
    );
    launch.appendChild(
      row(
        "Default open mode",
        "How this app should open when launched.",
        select(
          [
            { value: "workspace", label: "Inside My Space" },
            { value: "external", label: "Separate window" },
            { value: "ask", label: "Ask each time" },
          ],
          prefs.openMode || "workspace",
          (v) => {
            prefs = savePrefs({ openMode: v });
          }
        )
      )
    );

    const appearance = section("Appearance");
    appearance.appendChild(
      row(
        "Display name",
        "Name shown on the desktop and in Settings.",
        textInput(live.name, "App name", (v) => {
          const name = String(v || "").trim();
          if (!name) return;
          window.MySpaceConfig?.updateApp?.(live.id, { name });
          window.__myspaceAiRefreshDesktop?.();
          ctx.onOpenAppSettings?.(getLive());
        })
      )
    );
    appearance.appendChild(
      row(
        "Description",
        "Short subtitle under the app.",
        textInput(live.description || "", "Description", (v) => {
          window.MySpaceConfig?.updateApp?.(live.id, { description: v });
          ctx.onOpenAppSettings?.(getLive());
        })
      )
    );
    appearance.appendChild(
      row(
        "Compact icon",
        "Use a smaller icon on the desktop grid.",
        toggle(!!prefs.compactIcon, (on) => {
          prefs = savePrefs({ compactIcon: on });
        })
      )
    );
    appearance.appendChild(
      row(
        "Accent highlight",
        "Tint the app card with a soft accent.",
        select(
          [
            { value: "none", label: "None" },
            { value: "blue", label: "Blue" },
            { value: "green", label: "Green" },
            { value: "orange", label: "Orange" },
            { value: "violet", label: "Violet" },
          ],
          prefs.accent || "none",
          (v) => {
            prefs = savePrefs({ accent: v });
          }
        )
      )
    );

    const notes = section("Notifications");
    notes.appendChild(
      row(
        "Allow notifications",
        "Let this app show desktop toasts and alerts.",
        toggle(prefs.notifications !== false, (on) => {
          prefs = savePrefs({ notifications: on });
        })
      )
    );
    notes.appendChild(
      row(
        "Sound",
        "Play a short sound with notifications.",
        toggle(!!prefs.sound, (on) => {
          prefs = savePrefs({ sound: on });
        })
      )
    );
    notes.appendChild(
      row(
        "Quiet hours",
        "Silence alerts during quiet hours.",
        toggle(!!prefs.quietHours, (on) => {
          prefs = savePrefs({ quietHours: on });
        })
      )
    );

    const privacy = section("Privacy & data");
    privacy.appendChild(
      row(
        "Remember recent items",
        "Keep a short history of recent activity in this app.",
        toggle(prefs.recentItems !== false, (on) => {
          prefs = savePrefs({ recentItems: on });
        })
      )
    );
    privacy.appendChild(
      row(
        "Sync preferences",
        "Keep these settings with your My Space profile.",
        toggle(prefs.syncPrefs !== false, (on) => {
          prefs = savePrefs({ syncPrefs: on });
        })
      )
    );
    const dataActions = el("div", "appset-actions");
    dataActions.appendChild(
      actionBtn("Reset app preferences", "ghost", () => {
        localStorage.removeItem(prefsKey);
        prefs = {};
        window.showMySpaceToast?.("App preferences reset");
        ctx.onOpenAppSettings?.(getLive());
      })
    );
    dataActions.appendChild(
      actionBtn("Clear icon position", "ghost", () => {
        window.MySpaceConfig?.resetAppPosition?.(live.id);
        window.__myspaceAiRefreshDesktop?.();
        window.showMySpaceToast?.("Icon position cleared");
      })
    );
    privacy.appendChild(dataActions);

    const shortcuts = section("Shortcuts");
    shortcuts.appendChild(
      row(
        "Open app",
        "Quick open from Settings.",
        actionBtn("Open", "primary", () => {
          window.__myspaceAiLaunchApp?.(getLive());
        })
      )
    );
    if (window.MySpaceConfig?.canRemove?.(live.id)) {
      shortcuts.appendChild(
        row(
          "Remove shortcut",
          "Remove this app from My Space (does not uninstall from Windows).",
          actionBtn("Remove", "danger", async () => {
            const ok = window.confirm(`Remove "${live.name}" from My Space?`);
            if (!ok) return;
            await window.MySpaceConfig.removeApp(live.id);
            window.__myspaceAiRefreshDesktop?.();
            window.showMySpaceToast?.(`Removed ${live.name}`);
            ctx.onBackToApps?.();
          })
        )
      );
    }

    const about = section("About");
    const aboutGrid = el("div", "appset-about");
    const aboutRows = [
      ["ID", live.id],
      ["Type", live.type || "—"],
      ["Module", live.module || "—"],
      ["URL", live.url || "—"],
      ["Paths", Array.isArray(live.paths) ? live.paths.join(", ") : live.paths || "—"],
    ];
    aboutRows.forEach(([k, v]) => {
      const item = el("div", "appset-about-item");
      item.appendChild(el("div", "appset-about-key", k));
      item.appendChild(el("div", "appset-about-val", String(v || "—")));
      aboutGrid.appendChild(item);
    });
    about.appendChild(aboutGrid);

    return pane;
  }

  function buildAppsPane(onOpenAppSettings) {
    const pane = el("div", "settings-pane settings-pane--apps");
    const grid = el("div", "settings-apps-grid");
    pane.appendChild(grid);

    const apps = (window.MySpaceConfig?.getApps?.() || []).filter((a) => a.id !== "welcome");

    apps.forEach((app) => {
      const btn = el("button", "settings-app-card");
      btn.type = "button";
      btn.title = app.name;
      btn.setAttribute("aria-label", `${app.name} settings`);
      if (app.hidden) btn.classList.add("is-hidden-app");

      const iconWrap = el("div", "settings-app-card-icon");
      const emoji = window.MySpaceIcons?.emojiFallback?.(app) || "📦";
      iconWrap.textContent = emoji;
      btn.appendChild(iconWrap);

      btn.appendChild(el("span", "settings-app-card-name", app.name || app.id));
      if (app.hidden) {
        btn.appendChild(el("span", "settings-app-card-badge", "Hidden"));
      }

      btn.addEventListener("click", () => onOpenAppSettings?.(app));

      resolveAppIconSrc(app).then((src) => {
        if (!src || !btn.isConnected) return;
        const img = document.createElement("img");
        img.src = src;
        img.alt = "";
        img.draggable = false;
        img.addEventListener("error", () => {
          iconWrap.replaceChildren();
          iconWrap.textContent = emoji;
        });
        iconWrap.replaceChildren(img);
      });

      grid.appendChild(btn);
    });

    return pane;
  }

  function buildCategoryPane(categoryId, ctx = {}) {
    switch (categoryId) {
      case "general":
        return buildGeneralPane();
      case "backgrounds":
        return buildBackgroundsPane();
      case "apps":
        if (ctx.appSettingsApp) {
          return buildAppSettingsPane(ctx.appSettingsApp, {
            onOpenAppSettings: ctx.onOpenAppSettings,
            onBackToApps: ctx.onBackToApps,
          });
        }
        return buildAppsPane(ctx.onOpenAppSettings);
      case "languages-time":
        return buildLanguagesTimePane();
      case "tools":
        return buildToolsPane();
      default:
        return emptyPane();
    }
  }

  function buildPage() {
    const root = el("div", "settings-page");
    root.setAttribute("role", "application");
    root.setAttribute("aria-label", "Settings");

    const nav = el("aside", "settings-nav");
    nav.setAttribute("aria-label", "Settings categories");

    const list = el("nav", "settings-nav-list");
    list.setAttribute("role", "tablist");
    nav.appendChild(list);

    const main = el("main", "settings-main");
    const mainInner = el("div", "settings-main-inner");
    main.appendChild(mainInner);

    let activeId = CATEGORIES[0]?.id || "general";
    let appSettingsApp = null;

    function renderMain() {
      mainInner.classList.toggle("settings-main-inner--flush-tools", activeId === "tools");
      mainInner.replaceChildren(
        buildCategoryPane(activeId, {
          appSettingsApp: activeId === "apps" ? appSettingsApp : null,
          onOpenAppSettings: (app) => {
            appSettingsApp = app;
            renderMain();
          },
          onBackToApps: () => {
            appSettingsApp = null;
            renderMain();
          },
        })
      );
      list.querySelectorAll(".settings-nav-item").forEach((btn) => {
        const on = btn.dataset.category === activeId;
        btn.classList.toggle("is-active", on);
        btn.setAttribute("aria-selected", on ? "true" : "false");
      });
    }

    CATEGORIES.forEach((cat) => {
      const btn = el("button", "settings-nav-item");
      btn.type = "button";
      btn.dataset.category = cat.id;
      btn.setAttribute("role", "tab");
      btn.appendChild(el("span", "settings-nav-item-label", cat.label));
      btn.addEventListener("click", () => {
        activeId = cat.id;
        appSettingsApp = null;
        renderMain();
      });
      list.appendChild(btn);
    });

    root.appendChild(nav);
    root.appendChild(main);
    renderMain();
    return root;
  }

  function open() {
    if (!window.MySpaceWorkspace?.openPanel) {
      console.error("MySpaceWorkspace.openPanel is unavailable");
      return null;
    }
    return window.MySpaceWorkspace.openPanel({
      appId: "settings",
      title: "Settings",
      iconSrc: SETTINGS_ICON_GRAY,
      iconEmoji: "⚙",
      reuse: true,
      rebuild: true,
      buildContent: () => buildPage(),
    });
  }

  window.MySpaceSettingsPage = {
    open,
    CATEGORIES,
    SETTINGS_ICON_GRAY,
  };
})();
