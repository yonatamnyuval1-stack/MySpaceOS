(function () {
  let root = null;
  let open = false;
  const SHORTCUTS = [
    { keys: "Ctrl+K", desc: "Command palette" },
    { keys: "> …", desc: "Palette: run shell command" },
    { keys: "? …", desc: "Palette: ask AI" },
    { keys: "Ctrl+Shift+Space", desc: "Command palette (global)" },
    { keys: "Ctrl+/", desc: "Keyboard shortcuts" },
    { keys: "Ctrl+Shift+F", desc: "Open Files" },
    { keys: "Ctrl+Shift+N", desc: "New My Space window" },
    { keys: "Ctrl+\\", desc: "Snap side by side" },
    { keys: "Ctrl+Alt+Tab", desc: "Task View (virtual desktops)" },
    { keys: "Ctrl+Alt+← / →", desc: "Previous / next desktop" },
    { keys: "Ctrl+Alt+D", desc: "New desktop" },
    { keys: "Ctrl+Alt+W", desc: "Close current desktop" },
    { keys: "Tray desktop label", desc: "Open Task View" },
    { keys: "Pomodoro Start", desc: "Enter Focus (silence notifications)" },
    { keys: "Ctrl+T", desc: "New tab (in app)" },
    { keys: "Ctrl+W", desc: "Close tab (in app)" },
    { keys: "F5", desc: "Refresh current page" },
    { keys: "F11", desc: "Toggle fullscreen" },
    { keys: "Esc", desc: "Back / close overlay / exit snap" },
    { keys: "Right-click desktop", desc: "Classic shell line" },
    { keys: "Top-left corner", desc: "Show desktop" },
    { keys: "Top-right corner", desc: "Command palette" },
    { keys: "Bottom-left corner", desc: "Start menu" },
    { keys: "Bottom-right corner", desc: "Shortcuts help" },
  ];

  function ensure() {
    if (root) return root;
    root = document.createElement("div");
    root.className = "shortcuts-help hidden";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Keyboard shortcuts");
    root.innerHTML = `
      <div class="shortcuts-help-card">
        <header class="shortcuts-help-head">
          <h2>Shortcuts</h2>
          <button type="button" class="shortcuts-help-close" aria-label="Close">×</button>
        </header>
        <ul class="shortcuts-help-list"></ul>
        <p class="shortcuts-help-foot">Tip: Ctrl+K searches the whole system: stocks, builds, vault, space, history, lexicon, contacts, shell aliases…</p>
      </div>`;
    const list = root.querySelector(".shortcuts-help-list");
    list.innerHTML = SHORTCUTS.map(
      (s) => `<li><kbd>${s.keys}</kbd><span>${s.desc}</span></li>`
    ).join("");
    root.querySelector(".shortcuts-help-close").addEventListener("click", hide);
    root.addEventListener("click", (e) => {
      if (e.target === root) hide();
    });
    document.body.appendChild(root);
    return root;
  }

  function show() {
    ensure();
    open = true;
    root.classList.remove("hidden");
  }

  function hide() {
    open = false;
    root?.classList.add("hidden");
  }

  function toggle() {
    if (open) hide();
    else show();
  }

  function isOpen() {
    return open;
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && open) hide();
  });

  window.MySpaceShortcutsHelp = { show, hide, toggle, isOpen, SHORTCUTS };
})();