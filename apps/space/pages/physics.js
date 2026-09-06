window.SpacePages = window.SpacePages || {};

window.SpacePages.physics = (function () {
  const { escapeHtml, invoke } = window.Space;
  const C = window.SpacePhysics;

  const page = document.getElementById("page-physics");
  const constantsEl = document.getElementById("physics-constants");
  const topicsEl = document.getElementById("physics-topics");
  const resultEl = document.getElementById("physics-result");

  let pack = null;

  function renderConstants() {
    if (!pack?.constants) return;
    constantsEl.innerHTML = Object.entries(pack.constants)
      .map(
        ([key, c]) =>
          `<div class="const-card"><span class="const-key">${escapeHtml(key)}</span><span class="const-val">${escapeHtml(C.fmt(c.value, 6))}</span><span class="const-unit">${escapeHtml(c.unit)}</span><span class="const-label">${escapeHtml(c.label)}</span></div>`
      )
      .join("");
  }

  function renderTopics() {
    topicsEl.innerHTML = (pack?.topics || [])
      .map(
        (t) => `<article class="topic-card" data-topic="${escapeHtml(t.id)}">
          <h4>${escapeHtml(t.title)}</h4>
          <code class="formula">${escapeHtml(t.formula)}</code>
          <p class="muted">${escapeHtml(t.explain)}</p>
          <p class="topic-example"><strong>Example:</strong> ${escapeHtml(t.example)}</p>
        </article>`
      )
      .join("");
  }

  function bodyOptions() {
    return Object.entries(C.BODIES)
      .map(([id, b]) => `<option value="${id}">${escapeHtml(b.name)}</option>`)
      .join("");
  }

  function renderLab() {
    const lab = document.getElementById("physics-lab");
    lab.innerHTML = `
      <div class="lab-tabs" id="physics-lab-tabs">
        <button type="button" class="tab-btn active" data-lab="orbit">Orbital velocity</button>
        <button type="button" class="tab-btn" data-lab="escape">Escape velocity</button>
        <button type="button" class="tab-btn" data-lab="rocket">Rocket Δv</button>
        <button type="button" class="tab-btn" data-lab="light">Light time</button>
        <button type="button" class="tab-btn" data-lab="blackhole">Black hole radius</button>
        <button type="button" class="tab-btn" data-lab="kepler">Kepler period</button>
        <button type="button" class="tab-btn" data-lab="hohmann">Hohmann transfer</button>
      </div>
      <div class="lab-pane active" data-lab-pane="orbit">
        <p class="muted">Circular orbit: v = √(GM/r)</p>
        <label>Central body <select id="lab-orbit-body">${bodyOptions()}</select></label>
        <label>Altitude above surface (km) <input type="number" id="lab-orbit-alt" value="400" min="0" /></label>
        <button type="button" class="btn btn-primary btn-sm" data-run="orbit">Calculate</button>
      </div>
      <div class="lab-pane" data-lab-pane="escape" hidden>
        <p class="muted">v_esc = √(2GM/r) from surface or altitude</p>
        <label>Body <select id="lab-esc-body">${bodyOptions()}</select></label>
        <label>Altitude (km, 0 = surface) <input type="number" id="lab-esc-alt" value="0" min="0" /></label>
        <button type="button" class="btn btn-primary btn-sm" data-run="escape">Calculate</button>
      </div>
      <div class="lab-pane" data-lab-pane="rocket" hidden>
        <p class="muted">Tsiolkovsky: Δv = Isp · g₀ · ln(m₀/m_f)</p>
        <label>Specific impulse Isp (s) <input type="number" id="lab-isp" value="450" min="1" /></label>
        <label>Initial mass m₀ (kg) <input type="number" id="lab-m0" value="100000" min="1" /></label>
        <label>Final mass m_f (kg) <input type="number" id="lab-mf" value="15000" min="1" /></label>
        <button type="button" class="btn btn-primary btn-sm" data-run="rocket">Calculate</button>
      </div>
      <div class="lab-pane" data-lab-pane="light" hidden>
        <p class="muted">t = distance / c</p>
        <label>Distance <input type="number" id="lab-dist" value="1" min="0" step="any" /></label>
        <label>Unit <select id="lab-dist-unit"><option value="au">AU</option><option value="ly">Light-years</option><option value="km">km</option><option value="m">meters</option></select></label>
        <button type="button" class="btn btn-primary btn-sm" data-run="light">Calculate</button>
      </div>
      <div class="lab-pane" data-lab-pane="blackhole" hidden>
        <p class="muted">Schwarzschild radius R_s = 2GM/c²</p>
        <label>Mass (solar masses) <input type="number" id="lab-bh-msun" value="1" min="0.0001" step="any" /></label>
        <button type="button" class="btn btn-primary btn-sm" data-run="blackhole">Calculate</button>
      </div>
      <div class="lab-pane" data-lab-pane="kepler" hidden>
        <p class="muted">T (years) ≈ √(a³/M) for a in AU, M in solar masses</p>
        <label>Semi-major axis (AU) <input type="number" id="lab-kepler-a" value="1.52" min="0.01" step="any" /></label>
        <button type="button" class="btn btn-primary btn-sm" data-run="kepler">Calculate</button>
      </div>
      <div class="lab-pane" data-lab-pane="hohmann" hidden>
        <p class="muted">Coplanar Hohmann transfer between circular orbits</p>
        <label>Body <select id="lab-hoh-body">${bodyOptions()}</select></label>
        <label>Orbit 1 altitude (km) <input type="number" id="lab-hoh-r1" value="200" min="0" /></label>
        <label>Orbit 2 altitude (km) <input type="number" id="lab-hoh-r2" value="35786" min="0" /></label>
        <button type="button" class="btn btn-primary btn-sm" data-run="hohmann">Calculate</button>
      </div>
    `;

    lab.querySelector("#physics-lab-tabs")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-lab]");
      if (!btn) return;
      lab.querySelectorAll("[data-lab]").forEach((b) => b.classList.toggle("active", b === btn));
      lab.querySelectorAll(".lab-pane").forEach((p) => {
        p.hidden = p.dataset.labPane !== btn.dataset.lab;
        p.classList.toggle("active", p.dataset.labPane === btn.dataset.lab);
      });
    });

    lab.querySelectorAll("[data-run]").forEach((btn) => {
      btn.addEventListener("click", () => runLab(btn.dataset.run));
    });
  }

  function showResult(html) {
    resultEl.innerHTML = html;
    resultEl.classList.remove("hidden");
  }

  function runLab(kind) {
    try {
      if (kind === "orbit") {
        const body = C.BODIES[document.getElementById("lab-orbit-body").value];
        const alt = Number(document.getElementById("lab-orbit-alt").value) * 1000;
        const r = body.R + alt;
        const v = C.orbitalVelocity(body.M, r);
        showResult(`<strong>${escapeHtml(body.name)}</strong> at ${alt / 1000} km altitude:<br/>
          Orbital velocity <span class="result-big">${C.fmt(v / 1000, 3)} km/s</span><br/>
          Period ≈ ${C.formatDuration((2 * Math.PI * r) / v)}`);
      } else if (kind === "escape") {
        const body = C.BODIES[document.getElementById("lab-esc-body").value];
        const alt = Number(document.getElementById("lab-esc-alt").value) * 1000;
        const r = body.R + alt;
        const v = C.escapeVelocity(body.M, r);
        showResult(`Escape velocity: <span class="result-big">${C.fmt(v / 1000, 3)} km/s</span> (${escapeHtml(body.name)})`);
      } else if (kind === "rocket") {
        const isp = Number(document.getElementById("lab-isp").value);
        const m0 = Number(document.getElementById("lab-m0").value);
        const mf = Number(document.getElementById("lab-mf").value);
        const dv = C.rocketDeltaV(isp, m0, mf);
        showResult(`Δv = <span class="result-big">${C.fmt(dv / 1000, 3)} km/s</span> (mass ratio ${C.fmt(m0 / mf, 2)}:1)`);
      } else if (kind === "light") {
        const d = C.parseDist(document.getElementById("lab-dist").value, document.getElementById("lab-dist-unit").value);
        const t = C.lightTime(d);
        showResult(`Light travel time: <span class="result-big">${C.formatDuration(t)}</span>`);
      } else if (kind === "blackhole") {
        const msun = Number(document.getElementById("lab-bh-msun").value);
        const rs = C.schwarzschildRadius(msun * C.M_sun);
        showResult(`Schwarzschild radius: <span class="result-big">${C.fmt(rs / 1000, 3)} km</span> (${C.fmt(msun, 2)} M☉)`);
      } else if (kind === "kepler") {
        const a = Number(document.getElementById("lab-kepler-a").value);
        const T = C.keplerPeriodYears(a);
        showResult(`Orbital period: <span class="result-big">${C.fmt(T, 4)} years</span> (${C.fmt(T * 365.25, 1)} days)`);
      } else if (kind === "hohmann") {
        const body = C.BODIES[document.getElementById("lab-hoh-body").value];
        const r1 = body.R + Number(document.getElementById("lab-hoh-r1").value) * 1000;
        const r2 = body.R + Number(document.getElementById("lab-hoh-r2").value) * 1000;
        const { dv1, dv2, total } = C.hohmannDeltaV(r1, r2, body.M);
        showResult(`Hohmann Δv₁ = ${C.fmt(dv1 / 1000, 3)} km/s · Δv₂ = ${C.fmt(dv2 / 1000, 3)} km/s<br/>
          Total ≈ <span class="result-big">${C.fmt(total / 1000, 3)} km/s</span>`);
      }
    } catch (err) {
      showResult(`<p class="db-err">${escapeHtml(err.message)}</p>`);
    }
  }

  async function scan() {
    try {
      const res = await invoke("physics.pack", {});
      pack = res.pack;
      renderConstants();
      renderTopics();
      renderLab();
    } catch (err) {
      constantsEl.innerHTML = `<p class="db-err">${escapeHtml(err.message)}</p>`;
    }
  }

  function bind() {}

  return { id: "physics", page, scan, bind };
})();