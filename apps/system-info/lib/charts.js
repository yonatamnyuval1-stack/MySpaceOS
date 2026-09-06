window.SysInfoCharts = window.SysInfoCharts || {};

window.SysInfoCharts.drawLineChart = function (canvas, samples, key, options) {
  const opts = options || {};
  const color = opts.color || "#7eb8ff";
  const fill = opts.fill !== false;
  const label = opts.label || key;
  const maxY = opts.maxY != null ? opts.maxY : 100;

  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 400;
  const h = canvas.clientHeight || 160;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  if (!samples.length) {
    ctx.fillStyle = "rgba(138, 155, 176, 0.6)";
    ctx.font = "13px Segoe UI, sans-serif";
    ctx.fillText("Collecting data… wait for the next scheduled refresh.", 16, h / 2);
    return;
  }

  const pad = { l: 44, r: 12, t: 16, b: 28 };
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;
  const t0 = samples[0].t;
  const t1 = samples[samples.length - 1].t || t0 + 1;

  const points = samples.map((s) => ({
    x: pad.l + ((s.t - t0) / (t1 - t0 || 1)) * plotW,
    y: pad.t + plotH - (Math.min(maxY, Math.max(0, s[key] || 0)) / maxY) * plotH,
    v: s[key],
  }));

  ctx.strokeStyle = "rgba(120, 180, 220, 0.12)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (plotH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(w - pad.r, y);
    ctx.stroke();
    const val = Math.round(maxY - (maxY * i) / 4);
    ctx.fillStyle = "rgba(138, 155, 176, 0.7)";
    ctx.font = "10px Segoe UI, sans-serif";
    ctx.fillText(`${val}%`, 6, y + 4);
  }

  if (fill && points.length > 1) {
    const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + plotH);
    grad.addColorStop(0, color.replace(")", ", 0.35)").replace("rgb", "rgba").replace("#3dd6c6", "rgba(61, 214, 198, 0.35)"));
    grad.addColorStop(1, "rgba(61, 214, 198, 0)");
    ctx.beginPath();
    ctx.moveTo(points[0].x, pad.t + plotH);
    points.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, pad.t + plotH);
    ctx.closePath();
    ctx.fillStyle = "rgba(61, 214, 198, 0.12)";
    ctx.fill();
  }

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.stroke();

  ctx.fillStyle = "rgba(138, 155, 176, 0.85)";
  ctx.font = "11px Segoe UI, sans-serif";
  ctx.fillText(label, pad.l, 12);

  const last = samples[samples.length - 1];
  ctx.fillStyle = color;
  ctx.font = "600 13px Segoe UI, sans-serif";
  ctx.fillText(`${Math.round(last[key] * 10) / 10}%`, w - pad.r - 48, 14);
};
