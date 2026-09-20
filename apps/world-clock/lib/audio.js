(function (root) {
  let ctx = null;

  function getCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return ctx;
  }

  function beep(freq, duration, gain) {
    try {
      const ac = getCtx();
      if (ac.state === "suspended") ac.resume();
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      g.gain.value = gain ?? 0.15;
      osc.connect(g);
      g.connect(ac.destination);
      const t = ac.currentTime;
      g.gain.setValueAtTime(gain ?? 0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc.start(t);
      osc.stop(t + duration);
    } catch (_) {
    }
  }

  function playAlarm() {
    const pattern = [
      [880, 0.2],
      [0, 0.08],
      [880, 0.2],
      [0, 0.08],
      [660, 0.35],
      [0, 0.1],
      [880, 0.25],
    ];
    let delay = 0;
    pattern.forEach(([f, d]) => {
      setTimeout(() => {
        if (f > 0) beep(f, d, 0.2);
      }, delay * 1000);
      delay += d;
    });
  }

  async function notify(title, body, kind) {
    playAlarm();
    if (window.myApp) {
      await window.myApp.invoke("notify", {
        title,
        body,
        kind: kind || "timer",
        bypassFocus: true,
      });
    }
  }

  async function notifyTimerDone(label) {
    function tt(key, fallback, vars) {
      const I = root.MySpaceI18n;
      if (!I?.t) return fallback || key;
      const v = I.t(key, vars);
      return v === key ? (fallback || key) : v;
    }
    await notify(
      tt("app.worldClock.timer.notifyTitle", "Timer finished"),
      label || tt("app.worldClock.timer.notifyBody", "Your countdown has ended."),
      "timer"
    );
  }

  async function notifyPomodoro(title, body) {
    await notify(title, body, "pomodoro");
  }

  root.ClockAudio = { playAlarm, notifyTimerDone, notifyPomodoro, beep };
})(window);
