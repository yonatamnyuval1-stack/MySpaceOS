(function () {
  const params = new URLSearchParams(window.location.search);
  const appTitle = params.get("title") || "App";
  const appIcon = params.get("icon") || "📦";
  const appSub = params.get("sub") || "Sign in to continue";

  function withNavigate(result) {
    if (result?.ok && result.navigateTo) {
      window.location.href = result.navigateTo;
    }
    return result;
  }

  function authFromMyApp(myApp) {
    return {
      authStatus: () => myApp.invoke("auth-status"),
      myspaceStatus: () => myApp.invoke("auth-myspace-status"),
      continueWithMyspace: (payload) =>
        myApp.invoke("auth-continue-myspace", payload || {}).then(withNavigate),
      register: (payload) => myApp.invoke("auth-register", payload).then(withNavigate),
      login: (payload) => myApp.invoke("auth-login", payload).then(withNavigate),
      logout: () => myApp.invoke("auth-logout").then(withNavigate),
      enterApp: () => myApp.invoke("auth-enter-app").then(withNavigate),
      getCurrentUser: () => myApp.invoke("auth-current-user"),
    };
  }

  const auth = window.appAuth || (window.myApp ? authFromMyApp(window.myApp) : null);
  if (!auth) {
    document.body.innerHTML =
      "<p style='color:#f07178;padding:24px'>Auth bridge not loaded. Reopen the app from the desktop.</p>";
    return;
  }

  document.title = `${appTitle} — Sign in`;

  const ui = {
    icon: document.getElementById("login-icon"),
    title: document.getElementById("login-title"),
    welcome: document.getElementById("login-welcome"),
    welcomeUser: document.getElementById("welcome-user"),
    btnContinue: document.getElementById("btn-continue"),
    btnSwitch: document.getElementById("btn-switch"),
    authPanel: document.getElementById("login-auth-panel"),
    sub: document.getElementById("login-sub"),
    btnMyspace: document.getElementById("btn-myspace"),
    btnMyspaceLabel: document.getElementById("btn-myspace-label"),
    myspaceHint: document.getElementById("myspace-hint"),
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
    switchText: document.getElementById("switch-text"),
    switchBtn: document.getElementById("switch-mode"),
    osSheet: document.getElementById("os-sheet"),
    osBackdrop: document.getElementById("os-sheet-backdrop"),
    osSub: document.getElementById("os-sheet-sub"),
    osTabSignIn: document.getElementById("os-tab-signin"),
    osTabRegister: document.getElementById("os-tab-register"),
    osForm: document.getElementById("os-form"),
    osUsername: document.getElementById("os-username"),
    osPassword: document.getElementById("os-password"),
    osPassword2: document.getElementById("os-password2"),
    osLabelPassword2: document.getElementById("os-label-password2"),
    osRemember: document.getElementById("os-remember"),
    osError: document.getElementById("os-error"),
    osSubmit: document.getElementById("os-submit"),
    osCancel: document.getElementById("os-cancel"),
    consentSheet: document.getElementById("consent-sheet"),
    consentBackdrop: document.getElementById("consent-backdrop"),
    consentAppName: document.getElementById("consent-app-name"),
    consentUsername: document.getElementById("consent-username"),
    consentScopes: document.getElementById("consent-scopes"),
    consentError: document.getElementById("consent-error"),
    consentAllow: document.getElementById("consent-allow"),
    consentDeny: document.getElementById("consent-deny"),
  };

  ui.icon.textContent = appIcon;
  ui.title.textContent = appTitle;
  ui.sub.textContent = appSub;
  ui.btnContinue.textContent = `Continue to ${appTitle}`;

  let mode = "signin";
  let hasUsers = false;
  let osMode = "signin";
  let osHasUsers = false;
  let myspaceUser = null;
  let pendingConsent = null;

  function showError(msg) {
    if (!msg) {
      ui.error.classList.add("hidden");
      ui.error.textContent = "";
      return;
    }
    ui.error.textContent = msg;
    ui.error.classList.remove("hidden");
  }

  function showOsError(msg) {
    if (!msg) {
      ui.osError.classList.add("hidden");
      ui.osError.textContent = "";
      return;
    }
    ui.osError.textContent = msg;
    ui.osError.classList.remove("hidden");
  }

  function showConsentError(msg) {
    if (!ui.consentError) return;
    if (!msg) {
      ui.consentError.classList.add("hidden");
      ui.consentError.textContent = "";
      return;
    }
    ui.consentError.textContent = msg;
    ui.consentError.classList.remove("hidden");
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

  function refreshMyspaceHint() {
    if (!ui.myspaceHint || !ui.btnMyspace) return;
    const label = ui.btnMyspaceLabel || ui.btnMyspace;
    if (myspaceUser?.username) {
      label.textContent = `Continue as ${myspaceUser.username}`;
      ui.myspaceHint.textContent = "Confirm once — no password needed";
    } else {
      label.textContent = "Continue with My Space";
      ui.myspaceHint.textContent = osHasUsers
        ? "Use your signed-in My Space account across apps"
        : "Create a My Space account once — use it in every app";
    }
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
      ? "Create a local account for this app only"
      : appSub || "Sign in with a local app account";

    ui.submit.textContent = isRegister ? "Create account" : "Sign in";
    ui.password.autocomplete = isRegister ? "new-password" : "current-password";
    ui.password2.required = isRegister;

    ui.tabSignIn.disabled = !hasUsers;
    ui.tabSignIn.classList.toggle("login-tab-disabled", !hasUsers);
    ui.tabSignIn.classList.toggle("active", !isRegister);
    ui.tabRegister.classList.toggle("active", isRegister);

    ui.firstNote.classList.toggle("hidden", hasUsers);

    ui.rememberWrap.classList.toggle("hidden", isRegister);
    ui.labelPassword2.classList.toggle("hidden", !isRegister);
    ui.password2.classList.toggle("hidden", !isRegister);

    if (isRegister) {
      ui.switchText.textContent = "Already have an app account?";
      ui.switchBtn.textContent = "Sign in";
      ui.switchBtn.disabled = !hasUsers;
      ui.switchBtn.classList.toggle("login-link-disabled", !hasUsers);
    } else {
      ui.switchText.textContent = "Need a local app account?";
      ui.switchBtn.textContent = "Create one";
      ui.switchBtn.disabled = false;
      ui.switchBtn.classList.remove("login-link-disabled");
    }
  }

  function setOsMode(next) {
    if (!osHasUsers && next === "signin") next = "register";
    osMode = next;
    const isRegister = osMode === "register";
    ui.osSub.textContent = isRegister
      ? "Create your My Space account (used across apps)"
      : "Sign in to My Space once, then approve this app";
    ui.osSubmit.textContent = isRegister ? "Create account" : "Sign in";
    ui.osTabSignIn.disabled = !osHasUsers;
    ui.osTabSignIn.classList.toggle("login-tab-disabled", !osHasUsers);
    ui.osTabSignIn.classList.toggle("active", !isRegister);
    ui.osTabRegister.classList.toggle("active", isRegister);
    ui.osLabelPassword2.classList.toggle("hidden", !isRegister);
    ui.osPassword2.classList.toggle("hidden", !isRegister);
    ui.osPassword2.required = isRegister;
    showOsError("");
  }

  function openOsSheet() {
    closeConsentSheet();
    ui.osSheet.classList.remove("hidden");
    setOsMode(osHasUsers ? "signin" : "register");
    ui.osUsername.focus();
  }

  function closeOsSheet() {
    ui.osSheet.classList.add("hidden");
    showOsError("");
  }

  function openConsentSheet(payload) {
    pendingConsent = payload || null;
    closeOsSheet();
    const appName = payload?.app?.name || appTitle;
    const username = payload?.user?.username || myspaceUser?.username || "—";
    if (ui.consentAppName) ui.consentAppName.textContent = appName;
    if (ui.consentUsername) ui.consentUsername.textContent = username;
    if (ui.consentScopes) {
      ui.consentScopes.innerHTML = "";
      const scopes = Array.isArray(payload?.scopes) ? payload.scopes : [];
      for (const scope of scopes) {
        const li = document.createElement("li");
        const name = document.createElement("span");
        name.className = "consent-scope-name";
        name.textContent = scope.name || scope.id || "Info";
        const detail = document.createElement("span");
        detail.className = "consent-scope-detail";
        detail.textContent = scope.detail || "";
        li.appendChild(name);
        if (scope.detail) li.appendChild(detail);
        ui.consentScopes.appendChild(li);
      }
    }
    showConsentError("");
    ui.consentSheet?.classList.remove("hidden");
    ui.consentAllow?.focus();
  }

  function closeConsentSheet() {
    ui.consentSheet?.classList.add("hidden");
    showConsentError("");
    pendingConsent = null;
  }

  async function doContinueMyspace(payload) {
    const result = await auth.continueWithMyspace(payload || {});
    if (result?.needOsLogin) {
      osHasUsers = Boolean(result.hasUsers);
      openOsSheet();
      return result;
    }
    if (result?.needConsent) {
      myspaceUser = result.user || myspaceUser;
      refreshMyspaceHint();
      openConsentSheet(result);
      return result;
    }
    return result;
  }

  async function boot() {
    showAuthPanel();
    setMode("signin");

    try {
      if (typeof auth.myspaceStatus === "function") {
        const ms = await auth.myspaceStatus();
        osHasUsers = Boolean(ms?.hasUsers);
        myspaceUser = ms?.signedIn ? ms.user : null;
        refreshMyspaceHint();
      }
    } catch {
      osHasUsers = false;
      myspaceUser = null;
      refreshMyspaceHint();
    }

    try {
      const status = await auth.authStatus();
      hasUsers = Boolean(status?.hasUsers);
      if (status?.signedIn && status?.user?.username) {
        showWelcome(status.user.username);
        return;
      }
    } catch {
      hasUsers = false;
    }

    setMode(hasUsers ? "signin" : "register");
    ui.btnMyspace?.focus();
  }

  ui.btnMyspace?.addEventListener("click", async () => {
    showError("");
    ui.btnMyspace.disabled = true;
    if (ui.btnMyspaceLabel) ui.btnMyspaceLabel.textContent = "Please wait…";
    try {
      const result = await doContinueMyspace({ remember: true });
      if (!result?.ok && !result?.needOsLogin && !result?.needConsent) {
        showError(result?.error || "Could not continue with My Space");
      }
    } catch (err) {
      showError(err?.message || "Could not continue with My Space");
    } finally {
      ui.btnMyspace.disabled = false;
      refreshMyspaceHint();
    }
  });

  ui.consentAllow?.addEventListener("click", async () => {
    showConsentError("");
    ui.consentAllow.disabled = true;
    try {
      const result = await doContinueMyspace({ consent: true, remember: true });
      if (!result?.ok && !result?.needConsent && !result?.needOsLogin) {
        showConsentError(result?.error || "Could not continue");
      }
    } catch (err) {
      showConsentError(err?.message || "Could not continue");
    } finally {
      ui.consentAllow.disabled = false;
    }
  });

  ui.consentDeny?.addEventListener("click", () => closeConsentSheet());
  ui.consentBackdrop?.addEventListener("click", () => closeConsentSheet());

  ui.osForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    showOsError("");
    const username = ui.osUsername.value.trim();
    const password = ui.osPassword.value;
    if (osMode === "register" && password !== ui.osPassword2.value) {
      showOsError("Passwords do not match");
      return;
    }
    ui.osSubmit.disabled = true;
    try {
      // Sign in to OS only — then ask for app consent (no password again).
      const result = await doContinueMyspace({
        username,
        password,
        mode: osMode === "register" ? "register" : "login",
        remember: ui.osRemember.checked,
        consent: false,
      });
      if (result?.needConsent) {
        closeOsSheet();
        return;
      }
      if (!result?.ok) {
        showOsError(result?.error || "Could not sign in to My Space");
      }
    } catch (err) {
      showOsError(err?.message || "Could not sign in to My Space");
    } finally {
      ui.osSubmit.disabled = false;
    }
  });

  ui.osCancel?.addEventListener("click", () => closeOsSheet());
  ui.osBackdrop?.addEventListener("click", () => closeOsSheet());
  ui.osTabSignIn?.addEventListener("click", () => {
    if (osHasUsers) setOsMode("signin");
  });
  ui.osTabRegister?.addEventListener("click", () => setOsMode("register"));

  ui.btnContinue?.addEventListener("click", async () => {
    ui.btnContinue.disabled = true;
    try {
      const result = await auth.enterApp();
      if (!result?.ok) {
        showAuthPanel();
        showError(result?.error || "Could not open the app. Sign in again.");
        setMode(hasUsers ? "signin" : "register");
      }
    } catch (err) {
      showAuthPanel();
      showError(err?.message || "Could not open the app.");
      setMode(hasUsers ? "signin" : "register");
    } finally {
      ui.btnContinue.disabled = false;
    }
  });

  ui.btnSwitch?.addEventListener("click", async () => {
    await auth.logout();
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
        result = await auth.register({
          username,
          password,
          remember: ui.remember.checked,
        });
      } else {
        result = await auth.login({
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
