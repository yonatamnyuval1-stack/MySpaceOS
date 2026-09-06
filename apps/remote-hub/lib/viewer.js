window.RemoteHubViewer = (function () {
  const { invoke } = window.RemoteHub;

  const modal = document.getElementById("view-modal");
  const backdrop = document.getElementById("view-modal-backdrop");
  const closeBtn = document.getElementById("view-modal-close");
  const titleEl = document.getElementById("view-modal-title");
  const img = document.getElementById("view-img");
  const statusEl = document.getElementById("view-status");
  const hintEl = document.getElementById("view-hint");
  const userInput = document.getElementById("view-user");
  const passwordInput = document.getElementById("view-password");
  const intervalSel = document.getElementById("view-interval");
  const maxWidthSel = document.getElementById("view-maxw");
  const qualitySel = document.getElementById("view-quality");
  const btnStart = document.getElementById("view-start");
  const btnStop = document.getElementById("view-stop");
  const btnEnable = document.getElementById("view-enable");

  let timer = null;
  let running = false;
  let inFlight = false;
  let lastHost = "";
  let fatalError = false;

  function setStatus(text, kind) {
    statusEl.textContent = text || "";
    statusEl.className = `view-status ${kind || ""}`.trim();
  }

  function setHint(text) {
    if (!hintEl) return;
    hintEl.textContent = text || "";
  }

  function captureArgs() {
    return {
      host: lastHost,
      user: userInput?.value.trim() || "",
      password: passwordInput?.value || "",
      timeoutMs: 12000,
      maxWidth: parseInt(maxWidthSel.value, 10) || 1280,
      jpegQuality: parseInt(qualitySel.value, 10) || 70,
    };
  }

  async function runProbe() {
    if (!lastHost) return null;
    setStatus("Checking network and WinRM…", "muted");
    const probe = await invoke("screen.probe", { host: lastHost });
    if (!probe?.ok) {
      setStatus(probe?.error || "Probe failed", "bad");
      return probe;
    }
    const parts = [];
    if (probe.ping) parts.push(`Ping OK (${probe.latencyMs ?? "?"} ms)`);
    else parts.push("Ping failed");
    parts.push(probe.winrmPortOpen ? "WinRM port open" : "WinRM port closed");
    setStatus(parts.join(" · "), probe.ready ? "ok" : "bad");
    setHint(probe.hint || "");
    btnStart.disabled = !probe.ready;
    return probe;
  }

  function open({ host, user }) {
    lastHost = String(host || "").trim();
    if (!lastHost) return;

    if (userInput) userInput.value = String(user || "").trim();
    if (passwordInput) passwordInput.value = "";

    titleEl.textContent = `Live view · ${lastHost}`;
    modal.classList.remove("hidden");
    img.src = "";
    fatalError = false;
    btnStart.disabled = false;
    setStatus("Ready. Checking WinRM…", "muted");
    setHint("");
    stop();
    runProbe();
  }

  function close() {
    stop();
    modal.classList.add("hidden");
  }

  function goEnablePage() {
    document.querySelector('.nav-item[data-page="enable"]')?.click();
    close();
  }

  async function tick() {
    if (!running || inFlight || fatalError) return;
    inFlight = true;
    try {
      const res = await invoke("screen.capture", captureArgs());
      if (!res?.ok) {
        const err = new Error(res?.error || "Capture failed");
        err.code = res?.code;
        throw err;
      }
      const mime = res.mime || "image/jpeg";
      img.src = `data:${mime};base64,${res.dataBase64}`;
      setStatus(`Updated ${new Date().toLocaleTimeString()}`, "ok");
    } catch (err) {
      const code = err.code || "";
      setStatus(err.message || String(err), "bad");
      if (code === "winrm_not_ready" || code === "winrm_unreachable" || code === "auth_failed") {
        fatalError = true;
        stop();
        if (code === "winrm_not_ready" || code === "winrm_unreachable") {
          setHint(`On ${lastHost} (target): Enable access → WinRM → Run as Admin. On this PC: Client script.`);
        }
      }
    } finally {
      inFlight = false;
    }
  }

  async function start() {
    if (!lastHost) return;
    const probe = await runProbe();
    if (probe && !probe.ready) {
      setStatus("WinRM is not ready on that PC.", "bad");
      return;
    }

    stop();
    running = true;
    fatalError = false;
    btnStart.disabled = true;
    btnStop.disabled = false;
    setStatus("Connecting…", "muted");
    await tick();
    if (fatalError) return;
    const ms = parseInt(intervalSel.value, 10) || 1500;
    timer = setInterval(tick, ms);
  }

  function stop() {
    running = false;
    btnStart.disabled = false;
    btnStop.disabled = true;
    if (timer) clearInterval(timer);
    timer = null;
    inFlight = false;
  }

  backdrop?.addEventListener("click", close);
  closeBtn?.addEventListener("click", close);
  btnStart?.addEventListener("click", start);
  btnStop?.addEventListener("click", stop);
  btnEnable?.addEventListener("click", goEnablePage);

  document.addEventListener("keydown", (e) => {
    if (modal.classList.contains("hidden")) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  });

  intervalSel?.addEventListener("change", () => {
    if (running) start();
  });

  return { open, close, start, stop, probe: runProbe };
})();
