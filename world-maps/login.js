(function () {
  const ui = {
    welcome: document.getElementById("login-welcome"),
    welcomeUser: document.getElementById("welcome-user"),
    btnContinue: document.getElementById("btn-continue"),
    btnSwitch: document.getElementById("btn-switch"),
    authPanel: document.getElementById("login-auth-panel"),
    sub: document.getElementById("login-sub"),
    tabs: document.getElementById("login-tabs"),
    tabSignIn: document.getElementById("tab-signin"),
    tabRegister: document.getElementById("tab-register"),
    firstNote: document.getElementById("login-first-note"),
    form: document.getElementById("login-form"),
    username: document.getElementById("login-username"),
    password: document.getElementById("login-password"),
    password2: document.getElementById("login-password2"),
    labelPassword2: document.getElementById("label-password2"),
    rememberWrap: document.getElementById("remember-wrap"),
    remember: document.getElementById("login-remember"),
    error: document.getElementById("login-error"),
    submit: document.getElementById("login-submit"),
    switchWrap: document.getElementById("login-switch"),
    switchText: document.getElementById("switch-text"),
    switchBtn: document.getElementById("switch-mode"),
    syncPath: document.getElementById("sync-path"),
    syncHint: document.getElementById("sync-hint"),
    btnSyncPick: document.getElementById("btn-sync-pick"),
    btnSyncClear: document.getElementById("btn-sync-clear"),
  };

  let mode = "signin";
  let hasUsers = false;

  async function refreshSyncUi() {
    if (!window.worldMaps?.syncStatus) return;
    try {
      const sync = await window.worldMaps.syncStatus();
      if (!sync?.ok) return;
      if (sync.sharedEnabled && sync.sharedRoot) {
        ui.syncPath.textContent = sync.sharedReachable
          ? `Linked · ${sync.accountCount} account(s): ${(sync.usernames || []).join(", ") || "—"}`
          : `Linked but unreachable: ${sync.sharedRoot}`;
        ui.syncPath.title = sync.sharedRoot;
        ui.btnSyncClear?.classList.remove("hidden");
        ui.syncHint.textContent =
          "Accounts in this folder are shared. Create an account on another PC linked to the same folder and it will show up here after refresh.";
      } else {
        ui.syncPath.textContent = "Not linked: accounts stay on this PC only";
        ui.syncPath.title = "";
        ui.btnSyncClear?.classList.add("hidden");
        ui.syncHint.textContent =
          "Point both PCs at the same OneDrive / network folder so new accounts appear everywhere.";
      }
      if (typeof sync.accountCount === "number") {
        hasUsers = sync.accountCount > 0;
      }
    } catch {
    }
  }

  function showError(msg) {
    if (!msg) {
      ui.error.classList.add("hidden");
      ui.error.textContent = "";
      return;
    }
    ui.error.textContent = msg;
    ui.error.classList.remove("hidden");
  }

  function showWelcome(username) {
    ui.welcomeUser.textContent = username;
    ui.welcome.classList.remove("hidden");
    ui.authPanel.classList.add("hidden");
    ui.sub.textContent = "You are signed in on this computer";
  }

  function showAuthPanel() {
    ui.welcome.classList.add("hidden");
    ui.authPanel.classList.remove("hidden");
  }

  function setMode(next) {
    if (!hasUsers && next === "signin") next = "register";
    mode = next;
    updateModeUi();
    showError("");
    if (mode === "signin") ui.password2.value = "";
  }

  function updateModeUi() {
    const isRegister = mode === "register";

    ui.sub.textContent = isRegister
      ? "Create a new account on this computer"
      : "Sign in with your username and password";

    ui.submit.textContent = isRegister ? "Create account" : "Sign in";
    ui.password.autocomplete = isRegister ? "new-password" : "current-password";
    ui.password2.required = isRegister;

    ui.tabSignIn.disabled = !hasUsers;
    ui.tabSignIn.classList.toggle("login-tab-disabled", !hasUsers);
    ui.tabSignIn.classList.toggle("active", !isRegister);
    ui.tabRegister.classList.toggle("active", isRegister);

    ui.firstNote.classList.toggle("hidden", hasUsers);
    if (!hasUsers) {
      ui.firstNote.textContent =
        "No accounts on this PC yet. Create the first account below.";
    }

    ui.rememberWrap.classList.toggle("hidden", isRegister);
    ui.labelPassword2.classList.toggle("hidden", !isRegister);
    ui.password2.classList.toggle("hidden", !isRegister);

    if (isRegister) {
      ui.switchText.textContent = "Already have an account?";
      ui.switchBtn.textContent = "Sign in";
      ui.switchBtn.disabled = !hasUsers;
      ui.switchBtn.classList.toggle("login-link-disabled", !hasUsers);
    } else {
      ui.switchText.textContent = "Need a new account?";
      ui.switchBtn.textContent = "Create account";
      ui.switchBtn.disabled = false;
      ui.switchBtn.classList.remove("login-link-disabled");
    }
  }

  async function boot() {
    document.documentElement.lang = "en";
    document.documentElement.dir = "ltr";
    showAuthPanel();
    await refreshSyncUi();
    setMode("signin");

    try {
      const status = await window.worldMaps.authStatus();
      hasUsers = Boolean(status?.hasUsers);
      if (status?.signedIn && status?.user?.username) {
        showWelcome(status.user.username);
        return;
      }
    } catch {
      hasUsers = false;
    }

    setMode(hasUsers ? "signin" : "register");
    ui.username.focus();
  }

  ui.btnSyncPick?.addEventListener("click", async () => {
    ui.btnSyncPick.disabled = true;
    try {
      const res = await window.worldMaps.syncPickFolder();
      if (res?.canceled) return;
      if (!res?.ok) {
        showError(res?.error || "Could not link folder");
        return;
      }
      showError("");
      await refreshSyncUi();
      setMode(hasUsers ? "signin" : "register");
    } catch (err) {
      showError(err?.message || "Could not link folder");
    } finally {
      ui.btnSyncPick.disabled = false;
    }
  });

  ui.btnSyncClear?.addEventListener("click", async () => {
    ui.btnSyncClear.disabled = true;
    try {
      await window.worldMaps.syncClear();
      await refreshSyncUi();
      const status = await window.worldMaps.authStatus();
      hasUsers = Boolean(status?.hasUsers);
      setMode(hasUsers ? "signin" : "register");
    } catch (err) {
      showError(err?.message || "Could not unlink");
    } finally {
      ui.btnSyncClear.disabled = false;
    }
  });

  ui.btnContinue?.addEventListener("click", async () => {
    ui.btnContinue.disabled = true;
    try {
      const result = await window.worldMaps.enterApp();
      if (!result?.ok) {
        showAuthPanel();
        showError(result?.error || "Could not open the map. Sign in again.");
        setMode(hasUsers ? "signin" : "register");
      }
    } catch (err) {
      showAuthPanel();
      showError(err?.message || "Could not open the map.");
      setMode(hasUsers ? "signin" : "register");
    } finally {
      ui.btnContinue.disabled = false;
    }
  });

  ui.btnSwitch?.addEventListener("click", async () => {
    await window.worldMaps.logout();
    showAuthPanel();
    hasUsers = true;
    setMode("signin");
    ui.username.focus();
  });

  ui.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError("");

    const username = ui.username.value.trim();
    const password = ui.password.value;
    const isRegister = mode === "register";

    if (isRegister && password !== ui.password2.value) {
      showError("Passwords do not match");
      return;
    }

    ui.submit.disabled = true;
    ui.submit.textContent = "Please wait…";

    try {
      let result;
      if (isRegister) {
        result = await window.worldMaps.register({
          username,
          password,
          remember: ui.remember.checked,
        });
      } else {
        result = await window.worldMaps.login({
          username,
          password,
          remember: ui.remember.checked,
        });
      }

      if (!result?.ok) {
        showError(result?.error || "Something went wrong. Try again.");
        ui.submit.disabled = false;
        updateModeUi();
        return;
      }
    } catch (err) {
      showError(err?.message || "Something went wrong. Try again.");
      ui.submit.disabled = false;
      updateModeUi();
    }
  });

  ui.tabSignIn.addEventListener("click", () => {
    if (hasUsers) setMode("signin");
  });
  ui.tabRegister.addEventListener("click", () => setMode("register"));
  ui.switchBtn.addEventListener("click", () => {
    if (mode === "register" && hasUsers) setMode("signin");
    else setMode("register");
  });

  boot();
})();