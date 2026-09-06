(function () {
  let menuEl = null;
  let onAction = null;
  let activeIndex = -1;

  function ensureMenu() {
    if (menuEl) return menuEl;
    menuEl = document.createElement("nav");
    menuEl.className = "context-menu hidden";
    menuEl.setAttribute("role", "menu");
    document.body.appendChild(menuEl);
    return menuEl;
  }

  function getItems() {
    if (!menuEl) return [];
    return [...menuEl.querySelectorAll(".context-menu-item:not(:disabled)")];
  }

  function setActiveIndex(index) {
    const items = getItems();
    items.forEach((el, i) => el.classList.toggle("active", i === index));
    activeIndex = index;
    items[index]?.scrollIntoView({ block: "nearest" });
  }

  function hide() {
    activeIndex = -1;
    if (menuEl) {
      menuEl.classList.add("hidden");
      menuEl.replaceChildren();
    }
  }

  function buildHeader(header) {
    const wrap = document.createElement("div");
    wrap.className = "context-menu-header";

    if (header.icon) {
      const icon = document.createElement("span");
      icon.className = "context-menu-header-icon";
      icon.textContent = header.icon;
      wrap.appendChild(icon);
    }

    const text = document.createElement("div");
    text.className = "context-menu-header-text";

    const title = document.createElement("strong");
    title.className = "context-menu-header-title";
    title.textContent = header.title || "";
    text.appendChild(title);

    if (header.subtitle) {
      const sub = document.createElement("span");
      sub.className = "context-menu-header-sub";
      sub.textContent = header.subtitle;
      text.appendChild(sub);
    }

    wrap.appendChild(text);
    return wrap;
  }

  function buildItem(item) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "context-menu-item";
    btn.dataset.action = item.id;
    btn.disabled = Boolean(item.disabled);
    if (item.danger) btn.classList.add("danger");

    if (item.icon) {
      const icon = document.createElement("span");
      icon.className = "context-menu-item-icon";
      icon.textContent = item.icon;
      icon.setAttribute("aria-hidden", "true");
      btn.appendChild(icon);
    }

    const label = document.createElement("span");
    label.className = "context-menu-item-label";
    label.textContent = item.label;
    btn.appendChild(label);

    if (item.shortcut) {
      const shortcut = document.createElement("span");
      shortcut.className = "context-menu-item-shortcut";
      shortcut.textContent = item.shortcut;
      btn.appendChild(shortcut);
    }

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const action = item.id;
      hide();
      onAction?.(action);
    });

    return btn;
  }

  function show(x, y, items, actionHandler) {
    const menu = ensureMenu();
    onAction = actionHandler;
    menu.replaceChildren();
    activeIndex = -1;

    items.forEach((item) => {
      if (item.header) {
        menu.appendChild(buildHeader(item.header));
        return;
      }
      if (item.separator) {
        const sep = document.createElement("hr");
        sep.className = "context-menu-sep";
        menu.appendChild(sep);
        return;
      }
      menu.appendChild(buildItem(item));
    });

    menu.classList.remove("hidden");
    menu.style.visibility = "hidden";

    requestAnimationFrame(() => {
      if (menu.classList.contains("hidden")) return;
      const rect = menu.getBoundingClientRect();
      const left = Math.min(x, window.innerWidth - rect.width - 8);
      const top = Math.min(y, window.innerHeight - rect.height - 8);
      menu.style.left = `${Math.max(8, left)}px`;
      menu.style.top = `${Math.max(8, top)}px`;
      menu.style.visibility = "";
    });
  }

  document.addEventListener(
    "pointerdown",
    (e) => {
      if (!menuEl || menuEl.classList.contains("hidden")) return;
      if (menuEl.contains(e.target)) return;
      hide();
    },
    true
  );
  window.addEventListener("blur", hide);
  document.addEventListener("keydown", (e) => {
    if (!menuEl || menuEl.classList.contains("hidden")) return;

    if (e.key === "Escape") {
      hide();
      return;
    }

    const items = getItems();
    if (!items.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(activeIndex < items.length - 1 ? activeIndex + 1 : 0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(activeIndex > 0 ? activeIndex - 1 : items.length - 1);
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      items[activeIndex].click();
    }
  });

  window.MySpaceContextMenu = { show, hide };
})();
