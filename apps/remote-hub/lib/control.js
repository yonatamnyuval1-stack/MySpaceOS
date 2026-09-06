window.RemoteHubControl = (function () {
  const { invoke } = window.RemoteHub;

  const modal = document.getElementById("control-modal");
  const backdrop = document.getElementById("control-modal-backdrop");
  const closeBtn = document.getElementById("control-modal-close");
  const titleEl = document.getElementById("control-modal-title");
  const screen = document.getElementById("control-screen");
  const img = document.getElementById("control-img");
  const statusEl = document.getElementById("control-status");
  const hintEl = document.getElementById("control-hint");
  const btnConnect = document.getElementById("control-connect");
  const btnDisconnect = document.getElementById("control-disconnect");
  const btnRdp = document.getElementById("control-rdp");
  const btnAgentFolder = document.getElementById("control-agent-folder");
  const btnViewOnly = document.getElementById("control-view-only");
  const overlay = document.getElementById("control-overlay");

  const AGENT_PORT = 8765;
  const AGENT_TOKEN = "myspace";

  let ws = null;
  let connected = false;
  let lastHost = "";
  let machineId = null;
  let screenW = 1920;
  let screenH = 1080;
  let moveTimer = null;
  let lastMove = null;

  const VK = {
    Enter: 0x0d,
    Backspace: 0x08,
    Tab: 0x09,
    Escape: 0x1b,
    Space: 0x20,
    ArrowLeft: 0x25,
    ArrowUp: 0x26,
    ArrowRight: 0x27,
    ArrowDown: 0x28,
    Delete: 0x2e,
    Home: 0x24,
    End: 0x23,
    PageUp: 0x21,
    PageDown: 0x22,
    Insert: 0x2d,
    ControlLeft: 0x11,
    ControlRight: 0x11,
    ShiftLeft: 0x10,
    ShiftRight: 0x10,
    AltLeft: 0x12,
    AltRight: 0x12,
    MetaLeft: 0x5b,
    MetaRight: 0x5c,
    F1: 0x70,
    F2: 0x71,
    F3: 0x72,
    F4: 0x73,
    F5: 0x74,
    F6: 0x75,
    F7: 0x76,
    F8: 0x77,
    F9: 0x78,
    F10: 0x79,
    F11: 0x7a,
    F12: 0x7b,
  };

  function setStatus(text, kind) {
    statusEl.textContent = text || "";
    statusEl.className = `control-status ${kind || ""}`.trim();
  }

  function setHint(text) {
    if (hintEl) hintEl.textContent = text || "";
  }

  function keyToVk(e) {
    if (e.code.startsWith("Key") && e.code.length === 4) return e.code.charCodeAt(3);
    if (e.code.startsWith("Digit") && e.code.length === 6) return e.code.charCodeAt(5);
    if (VK[e.code]) return VK[e.code];
    if (e.key && e.key.length === 1) return e.key.toUpperCase().charCodeAt(0);
    return 0;
  }

  function sendInput(payload) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "input", ...payload }));
  }

  function mapCoords(clientX, clientY) {
    const rect = img.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
    const rx = (clientX - rect.left) / rect.width;
    const ry = (clientY - rect.top) / rect.height;
    return {
      x: Math.max(0, Math.min(screenW - 1, Math.round(rx * screenW))),
      y: Math.max(0, Math.min(screenH - 1, Math.round(ry * screenH))),
    };
  }

  function flushMove() {
    if (!lastMove) return;
    sendInput({ action: "move", x: lastMove.x, y: lastMove.y, button: 0, delta: 0, vk: 0 });
    lastMove = null;
  }

  function scheduleMove(x, y) {
    lastMove = { x, y };
    if (moveTimer) return;
    moveTimer = setTimeout(() => {
      moveTimer = null;
      flushMove();
    }, 32);
  }

  function onMouseMove(e) {
    if (!connected) return;
    const { x, y } = mapCoords(e.clientX, e.clientY);
    scheduleMove(x, y);
  }

  function onMouseDown(e) {
    if (!connected) return;
    e.preventDefault();
    screen.focus();
    flushMove();
    const { x, y } = mapCoords(e.clientX, e.clientY);
    sendInput({ action: "mousedown", x, y, button: e.button, delta: 0, vk: 0 });
  }

  function onMouseUp(e) {
    if (!connected) return;
    e.preventDefault();
    const { x, y } = mapCoords(e.clientX, e.clientY);
    sendInput({ action: "mouseup", x, y, button: e.button, delta: 0, vk: 0 });
  }

  function onWheel(e) {
    if (!connected) return;
    e.preventDefault();
    const { x, y } = mapCoords(e.clientX, e.clientY);
    sendInput({ action: "wheel", x, y, button: 0, delta: e.deltaY > 0 ? -120 : 120, vk: 0 });
  }

  function onKey(e) {
    if (!connected || modal.classList.contains("hidden")) return;
    if (e.key === "Escape" && !e.ctrlKey) {
      e.preventDefault();
      close();
      return;
    }
    const vk = keyToVk(e);
    if (!vk) return;
    e.preventDefault();
    sendInput({ action: e.type === "keydown" ? "keydown" : "keyup", x: 0, y: 0, button: 0, delta: 0, vk });
  }

  function disconnect() {
    connected = false;
    if (ws) {
      try {
        ws.close();
      } catch (_) {
      }
      ws = null;
    }
    btnConnect.disabled = false;
    btnDisconnect.disabled = true;
    screen.classList.remove("control-screen--live");
    overlay?.classList.remove("hidden");
  }

  function connectWs() {
    return new Promise((resolve, reject) => {
      const url = `ws://${lastHost}:${AGENT_PORT}?token=${encodeURIComponent(AGENT_TOKEN)}`;
      const socket = new WebSocket(url);
      const timeout = setTimeout(() => {
        try {
          socket.close();
        } catch (_) {
        }
        reject(new Error("Agent connection timed out."));
      }, 8000);

      socket.onopen = () => {
        clearTimeout(timeout);
        ws = socket;
        connected = true;
        btnConnect.disabled = true;
        btnDisconnect.disabled = false;
        screen.classList.add("control-screen--live");
        overlay?.classList.add("hidden");
        screen.focus();
        setStatus("Connected — mouse & keyboard active", "ok");
        setHint("Click the screen to capture keyboard. Esc closes (when screen focused).");
        resolve();
      };

      socket.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "frame" && msg.data) {
            if (msg.screenW) screenW = msg.screenW;
            if (msg.screenH) screenH = msg.screenH;
            img.src = `data:${msg.mime || "image/jpeg"};base64,${msg.data}`;
          }
        } catch (_) {
        }
      };

      socket.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("Could not connect to Remote Agent."));
      };

      socket.onclose = () => {
        if (connected) {
          connected = false;
          setStatus("Disconnected from agent.", "bad");
        }
        btnConnect.disabled = false;
        btnDisconnect.disabled = true;
        screen.classList.remove("control-screen--live");
        overlay?.classList.remove("hidden");
        ws = null;
      };
    });
  }

  async function connect() {
    if (!lastHost) return;
    setStatus("Checking agent…", "muted");
    const probe = await invoke("agent.probe", { host: lastHost, port: AGENT_PORT });
    if (!probe?.agentReady) {
      setStatus("Agent not running on target PC.", "bad");
      setHint(probe?.hint || "Install agent via Enable access.");
      return;
    }
    setStatus("Connecting…", "muted");
    try {
      await connectWs();
    } catch (err) {
      setStatus(err.message || "Connection failed", "bad");
    }
  }

  function open({ host, id, user }) {
    lastHost = String(host || "").trim();
    machineId = id || null;
    if (!lastHost) return;

    titleEl.textContent = `Control · ${lastHost}`;
    modal.classList.remove("hidden");
    img.src = "";
    disconnect();
    setStatus("Ready. Click Connect for full control.", "muted");
    setHint("Requires My Space Agent on the target (port 8765). Enable access → Remote Agent.");
    invoke("agent.probe", { host: lastHost }).then((p) => {
      if (p?.agentReady) {
        setStatus("Agent detected — click Connect.", "ok");
      }
    });
  }

  function close() {
    disconnect();
    modal.classList.add("hidden");
  }

  async function openRdp() {
    if (!lastHost) return;
    try {
      if (machineId) {
        await invoke("connect", { id: machineId, mode: "rdp" });
      } else {
        await invoke("connect", { quick: true, host: lastHost, connectionType: "rdp", mode: "rdp" });
      }
    } catch (err) {
      alert(err.message);
    }
  }

  backdrop?.addEventListener("click", close);
  closeBtn?.addEventListener("click", close);
  btnConnect?.addEventListener("click", connect);
  btnDisconnect?.addEventListener("click", disconnect);
  btnRdp?.addEventListener("click", openRdp);
  btnAgentFolder?.addEventListener("click", () => invoke("agent.openFolder"));
  btnViewOnly?.addEventListener("click", () => {
    close();
    window.RemoteHubViewer?.open({ host: lastHost });
  });

  screen?.addEventListener("mousemove", onMouseMove);
  screen?.addEventListener("mousedown", onMouseDown);
  screen?.addEventListener("mouseup", onMouseUp);
  screen?.addEventListener("wheel", onWheel, { passive: false });
  screen?.addEventListener("contextmenu", (e) => e.preventDefault());
  screen?.addEventListener("keydown", onKey);
  screen?.addEventListener("keyup", onKey);

  return { open, close, connect, disconnect };
})();
