window.StocksCharts = (function () {
  const MA20_COLOR = "rgba(255, 200, 87, 0.9)";
  const MA50_COLOR = "rgba(155, 114, 255, 0.9)";

  function formatDate(ts) {
    try {
      return new Date(ts).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  function attachInteractiveChart(canvas, tooltipEl, options) {
    const state = {
      points: [],
      changePct: 0,
      mode: "line",
      showMA20: true,
      showMA50: true,
      showVolume: true,
      hoverIndex: null,
      ma20: [],
      ma50: [],
    };

    function priceColor() {
      return (state.changePct ?? 0) >= 0 ? "#5ddea8" : "#f07178";
    }

    function layout(w, h) {
      const volH = state.showVolume ? Math.round(h * 0.22) : 0;
      const gap = volH ? 8 : 0;
      const priceH = h - volH - gap;
      return {
        pad: { l: 56, r: 12, t: 18, b: 24 },
        priceH,
        volTop: priceH + gap,
        volH,
        w,
        h,
      };
    }

    function yPrice(v, minY, maxY, padT, plotH) {
      return padT + plotH - ((v - minY) / (maxY - minY || 1)) * plotH;
    }

    function indexFromX(x, padL, plotW, len) {
      if (len <= 1) return 0;
      const t = Math.max(0, Math.min(1, (x - padL) / plotW));
      return Math.round(t * (len - 1));
    }

    function draw() {
      const ctx = canvas.getContext("2d");
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth || 400;
      const h = canvas.clientHeight || 320;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      const pts = state.points;
      if (!pts.length) {
        ctx.fillStyle = "rgba(138, 155, 176, 0.6)";
        ctx.font = "13px Segoe UI, sans-serif";
        ctx.fillText("No chart data", 16, h / 2);
        return null;
      }

      const L = layout(w, h);
      const plotW = L.w - L.pad.l - L.pad.r;
      const closes = pts.map((p) => p.close);
      let minY = Math.min(...closes);
      let maxY = Math.max(...closes);
      if (state.showMA20) {
        state.ma20.forEach((v) => {
          if (v != null) {
            minY = Math.min(minY, v);
            maxY = Math.max(maxY, v);
          }
        });
      }
      if (state.showMA50) {
        state.ma50.forEach((v) => {
          if (v != null) {
            minY = Math.min(minY, v);
            maxY = Math.max(maxY, v);
          }
        });
      }
      const padY = (maxY - minY) * 0.06 || 1;
      minY -= padY;
      maxY += padY;

      const xAt = (i) => L.pad.l + (i / Math.max(1, pts.length - 1)) * plotW;

      ctx.strokeStyle = "rgba(120, 180, 220, 0.1)";
      for (let i = 0; i <= 4; i++) {
        const y = L.pad.t + (L.priceH * i) / 4;
        ctx.beginPath();
        ctx.moveTo(L.pad.l, y);
        ctx.lineTo(L.w - L.pad.r, y);
        ctx.stroke();
        const val = maxY - ((maxY - minY) * i) / 4;
        ctx.fillStyle = "rgba(138, 155, 176, 0.65)";
        ctx.font = "10px Segoe UI, sans-serif";
        ctx.fillText(`$${val.toFixed(val > 200 ? 0 : 2)}`, 4, y + 4);
      }

      if (state.mode === "candle") {
        const candleW = Math.max(2, Math.min(10, plotW / pts.length - 1));
        pts.forEach((p, i) => {
          const x = xAt(i);
          const open = p.open ?? p.close;
          const close = p.close;
          const high = p.high ?? Math.max(open, close);
          const low = p.low ?? Math.min(open, close);
          const up = close >= open;
          const col = up ? "#5ddea8" : "#f07178";
          const yH = yPrice(high, minY, maxY, L.pad.t, L.priceH);
          const yL = yPrice(low, minY, maxY, L.pad.t, L.priceH);
          const yO = yPrice(open, minY, maxY, L.pad.t, L.priceH);
          const yC = yPrice(close, minY, maxY, L.pad.t, L.priceH);
          ctx.strokeStyle = col;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, yH);
          ctx.lineTo(x, yL);
          ctx.stroke();
          ctx.fillStyle = up ? "rgba(93, 222, 168, 0.85)" : "rgba(240, 113, 120, 0.85)";
          const top = Math.min(yO, yC);
          const bot = Math.max(yO, yC);
          ctx.fillRect(x - candleW / 2, top, candleW, Math.max(1, bot - top));
        });
      } else {
        const color = priceColor();
        const coords = pts.map((p, i) => ({
          x: xAt(i),
          y: yPrice(p.close, minY, maxY, L.pad.t, L.priceH),
        }));
        ctx.beginPath();
        ctx.moveTo(coords[0].x, L.pad.t + L.priceH);
        coords.forEach((c) => ctx.lineTo(c.x, c.y));
        ctx.lineTo(coords[coords.length - 1].x, L.pad.t + L.priceH);
        ctx.closePath();
        ctx.fillStyle = state.changePct >= 0 ? "rgba(93, 222, 168, 0.12)" : "rgba(240, 113, 120, 0.12)";
        ctx.fill();
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        coords.forEach((c, i) => (i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y)));
        ctx.stroke();
      }

      function drawMA(series, color) {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        let started = false;
        series.forEach((v, i) => {
          if (v == null) return;
          const x = xAt(i);
          const y = yPrice(v, minY, maxY, L.pad.t, L.priceH);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }

      if (state.showMA20) drawMA(state.ma20, MA20_COLOR);
      if (state.showMA50) drawMA(state.ma50, MA50_COLOR);

      if (state.showVolume && L.volH > 0) {
        const vols = pts.map((p) => p.volume || 0);
        const maxVol = Math.max(...vols, 1);
        const volBase = L.volTop + L.volH;
        pts.forEach((p, i) => {
          const x = xAt(i);
          const vh = (p.volume / maxVol) * (L.volH - 4);
          const up = i > 0 ? p.close >= (pts[i - 1]?.close ?? p.close) : state.changePct >= 0;
          ctx.fillStyle = up ? "rgba(93, 222, 168, 0.45)" : "rgba(240, 113, 120, 0.45)";
          const barW = Math.max(2, plotW / pts.length - 1);
          ctx.fillRect(x - barW / 2, volBase - vh, barW, vh);
        });
        ctx.fillStyle = "rgba(138, 155, 176, 0.5)";
        ctx.font = "10px Segoe UI, sans-serif";
        ctx.fillText("Volume", L.pad.l, L.volTop - 2);
      }

      if (state.hoverIndex != null && pts[state.hoverIndex]) {
        const i = state.hoverIndex;
        const x = xAt(i);
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = "rgba(91, 156, 255, 0.6)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, L.pad.t);
        ctx.lineTo(x, L.volTop + L.volH);
        ctx.stroke();
        ctx.setLineDash([]);
        const p = pts[i];
        ctx.fillStyle = "#5b9cff";
        ctx.beginPath();
        ctx.arc(x, yPrice(p.close, minY, maxY, L.pad.t, L.priceH), 4, 0, Math.PI * 2);
        ctx.fill();
      }

      return { minY, maxY, plotW, xAt, L };
    }

    function updateTooltip(i) {
      if (!tooltipEl || i == null || !state.points[i]) {
        if (tooltipEl) tooltipEl.classList.add("hidden");
        return;
      }
      const p = state.points[i];
      const prev = state.points[i - 1];
      const chg = prev?.close ? p.close - prev.close : 0;
      const chgPct = prev?.close ? (chg / prev.close) * 100 : 0;
      const cls = chgPct >= 0 ? "up" : "down";
      tooltipEl.classList.remove("hidden");
      tooltipEl.innerHTML = `
        <span class="tt-date">${formatDate(p.t)}</span>
        <span>O <b>${(p.open ?? p.close).toFixed(2)}</b> H <b>${(p.high ?? p.close).toFixed(2)}</b> L <b>${(p.low ?? p.close).toFixed(2)}</b> C <b>${p.close.toFixed(2)}</b></span>
        <span class="tt-chg ${cls}">${chg >= 0 ? "+" : ""}${chg.toFixed(2)} (${chgPct >= 0 ? "+" : ""}${chgPct.toFixed(2)}%)</span>
        ${p.volume ? `<span class="tt-vol">Vol ${window.Stocks.formatVol(p.volume)}</span>` : ""}
        ${state.ma20[i] != null ? `<span>MA20 ${state.ma20[i].toFixed(2)}</span>` : ""}
        ${state.ma50[i] != null ? `<span>MA50 ${state.ma50[i].toFixed(2)}</span>` : ""}`;
    }

    function onMove(e) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const L = layout(rect.width, rect.height);
      const plotW = L.w - L.pad.l - L.pad.r;
      const idx = indexFromX(x, L.pad.l, plotW, state.points.length);
      if (state.hoverIndex !== idx) {
        state.hoverIndex = idx;
        draw();
        updateTooltip(idx);
      }
      if (tooltipEl && state.points[idx]) {
        const tx = Math.min(rect.width - 200, Math.max(8, x + 12));
        const ty = 8;
        tooltipEl.style.left = `${tx}px`;
        tooltipEl.style.top = `${ty}px`;
      }
    }

    function onLeave() {
      state.hoverIndex = null;
      draw();
      if (tooltipEl) tooltipEl.classList.add("hidden");
    }

    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);
    const onResize = () => draw();
    window.addEventListener("resize", onResize);

    return {
      setData(points, changePct) {
        state.points = points || [];
        state.changePct = changePct ?? 0;
        state.ma20 = window.StocksAnalysis.sma(state.points, 20);
        state.ma50 = window.StocksAnalysis.sma(state.points, 50);
        state.hoverIndex = null;
        draw();
      },
      setOptions(opts) {
        if (opts.mode != null) state.mode = opts.mode;
        if (opts.showMA20 != null) state.showMA20 = opts.showMA20;
        if (opts.showMA50 != null) state.showMA50 = opts.showMA50;
        if (opts.showVolume != null) state.showVolume = opts.showVolume;
        draw();
      },
      destroy() {
        canvas.removeEventListener("mousemove", onMove);
        canvas.removeEventListener("mouseleave", onLeave);
        window.removeEventListener("resize", onResize);
      },
    };
  }

  function drawPriceChart(canvas, points, options) {
    const chart = attachInteractiveChart(canvas, null);
    chart.setData(points, options?.changePct ?? 0);
    if (options) chart.setOptions(options);
    return chart;
  }

  function drawSparkline(canvas, points, changePct) {
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 100;
    const h = canvas.clientHeight || 36;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    if (!points?.length) return;
    const color = (changePct ?? 0) >= 0 ? "#5ddea8" : "#f07178";
    const closes = points.map((p) => p.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const pad = 2;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    points.forEach((p, i) => {
      const x = pad + (i / Math.max(1, points.length - 1)) * (w - pad * 2);
      const y = pad + (h - pad * 2) - ((p.close - min) / (max - min || 1)) * (h - pad * 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  return { attachInteractiveChart, drawPriceChart, drawSparkline };
})();
