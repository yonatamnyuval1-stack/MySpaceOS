(function () {
  const BROWSER_EXE_NAMES = new Set([
    "chrome.exe",
    "msedge.exe",
    "msedge_proxy.exe",
    "firefox.exe",
    "brave.exe",
    "opera.exe",
    "vivaldi.exe",
  ]);

  const HARD_TO_EMBED_EXE_NAMES = new Set([
    "explorer.exe",
    "applicationframehost.exe",
    "systemsettings.exe",
    "searchhost.exe",
    "shellexperiencehost.exe",
    "startmenuexperiencehost.exe",
    "textinputhost.exe",
    "windowsterminal.exe",
    "wt.exe",
    "cmd.exe",
    "powershell.exe",
    "pwsh.exe",
    "conhost.exe",
    "openconsole.exe",
  ]);

  const UNSAFE_WEBVIEW_HOSTS = [
    "google.com",
    "google.co.il",
    "googleusercontent.com",
    "gstatic.com",
    "youtube.com",
    "youtu.be",
    "facebook.com",
    "instagram.com",
    "twitter.com",
    "x.com",
    "tiktok.com",
    "accounts.google.com",
    "login.microsoftonline.com",
    "microsoftonline.com",
    "live.com",
    "office.com",
    "office365.com",
    "outlook.com",
    "hotmail.com",
    "amazon.com",
    "netflix.com",
    "discord.com",
    "zoom.us",
  ];

  function isBrowserExecutable(exePath) {
    if (!exePath) return false;
    const base = exePath.split(/[/\\]/).pop()?.toLowerCase() || "";
    return BROWSER_EXE_NAMES.has(base);
  }

  function isHardToEmbedExecutable(exePath) {
    if (!exePath) return false;
    const base = exePath.split(/[/\\]/).pop()?.toLowerCase() || "";
    return HARD_TO_EMBED_EXE_NAMES.has(base) || BROWSER_EXE_NAMES.has(base);
  }

  function shouldEmbedExecutable(exePath) {
    return Boolean(exePath) && !isHardToEmbedExecutable(exePath);
  }

  function isUnsafeWebviewUrl(rawUrl) {
    try {
      let url = rawUrl?.trim();
      if (!url) return false;
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
      const host = new URL(url).hostname.toLowerCase();
      return UNSAFE_WEBVIEW_HOSTS.some(
        (blocked) => host === blocked || host.endsWith(`.${blocked}`)
      );
    } catch {
      return false;
    }
  }

  window.MySpaceAppRules = {
    isBrowserExecutable,
    isHardToEmbedExecutable,
    shouldEmbedExecutable,
    isUnsafeWebviewUrl,
  };
})();