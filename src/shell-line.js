(function () {
  let rootEl = null;
  let inputEl = null;
  let hintEl = null;
  let onSubmit = null;
  let open = false;

  function ensureRoot() {
    if (rootEl) return rootEl;

    rootEl = document.createElement("div");
    rootEl.className = "shell-line hidden";
    rootEl.setAttribute("role", "dialog");
    rootEl.setAttribute("aria-label", "Command line");

    const prompt = document.createElement("span");
    prompt.className = "shell-line-prompt";
    prompt.textContent = ">";

    inputEl = document.createElement("input");
    inputEl.type = "text";
    inputEl.className = "shell-line-input";
    inputEl.spellcheck = false;
    inputEl.autocomplete = "off";
    inputEl.setAttribute("aria-label", "Command");
    inputEl.placeholder = "enter command...";

    hintEl = document.createElement("div");
    hintEl.className = "shell-line-hint";
    hintEl.textContent = "for help: help. popular commands: run, check, if, when.";

    rootEl.appendChild(prompt);
    rootEl.appendChild(inputEl);
    rootEl.appendChild(hintEl);
    document.body.appendChild(rootEl);

    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        hide();
      }
    });

    return rootEl;
  }

  function positionAt(x, y) {
    const el = ensureRoot();
    el.classList.remove("hidden");
    el.style.visibility = "hidden";

    requestAnimationFrame(() => {
      if (el.classList.contains("hidden")) return;
      const rect = el.getBoundingClientRect();
      const left = Math.min(x, window.innerWidth - rect.width - 12);
      const top = Math.min(y, window.innerHeight - rect.height - 12);
      el.style.left = `${Math.max(12, left)}px`;
      el.style.top = `${Math.max(12, top)}px`;
      el.style.visibility = "";
    });
  }

  function submit() {
    const value = inputEl.value.trim();
    const handler = onSubmit;
    hide();
    if (value && handler) handler(value);
  }

  function show(x, y, submitHandler) {
    const el = ensureRoot();
    onSubmit = submitHandler;
    open = true;
    inputEl.value = "";
    el.classList.remove("centered");
    el.classList.remove("hidden");
    positionAt(x, y);
    inputEl.focus();
  }

  function showCentered(submitHandler) {
    const el = ensureRoot();
    onSubmit = submitHandler;
    open = true;
    inputEl.value = "";
    el.classList.add("centered");
    el.classList.remove("hidden");
    el.style.left = "";
    el.style.top = "";
    el.style.visibility = "";
    inputEl.focus();
  }

  function hide() {
    open = false;
    onSubmit = null;
    if (rootEl) {
      rootEl.classList.add("hidden");
      rootEl.classList.remove("centered");
    }
  }

  function isOpen() {
    return open;
  }

  document.addEventListener(
    "pointerdown",
    (e) => {
      if (!open || !rootEl || rootEl.contains(e.target)) return;
      hide();
    },
    true
  );

  window.addEventListener("blur", hide);

  window.MySpaceShellLine = { show, showCentered, hide, isOpen };
})();