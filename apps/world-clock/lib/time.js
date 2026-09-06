(function (root) {
  const { pad2 } = root.ClockUtils;

  function getAllTimeZones() {
    try {
      if (typeof Intl.supportedValuesOf === "function") {
        return Intl.supportedValuesOf("timeZone");
      }
    } catch (_) {
    }
    const set = new Set();
    (root.ClockCountryData?.list || []).forEach((c) => c.zones.forEach((z) => set.add(z)));
    return [...set];
  }

  function zoneCityName(zoneId) {
    const part = zoneId.split("/").pop() || zoneId;
    return part.replace(/_/g, " ");
  }

  function formatInZone(date, timeZone, opts) {
    try {
      return new Intl.DateTimeFormat("en-US", { timeZone, ...opts }).format(date);
    } catch (_) {
      return "—";
    }
  }

  function getPartsInZone(date, timeZone) {
    try {
      const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      const parts = fmt.formatToParts(date);
      const map = {};
      parts.forEach((p) => {
        if (p.type !== "literal") map[p.type] = p.value;
      });
      return {
        year: parseInt(map.year, 10),
        month: parseInt(map.month, 10),
        day: parseInt(map.day, 10),
        hour: parseInt(map.hour, 10),
        minute: parseInt(map.minute, 10),
        second: parseInt(map.second, 10),
      };
    } catch (_) {
      return null;
    }
  }

  function getOffsetLabel(date, timeZone) {
    try {
      const short = new Intl.DateTimeFormat("en-US", {
        timeZone,
        timeZoneName: "shortOffset",
      })
        .formatToParts(date)
        .find((p) => p.type === "timeZoneName");
      return short?.value || "";
    } catch (_) {
      return "";
    }
  }

  function clockAngles(date, timeZone) {
    const p = getPartsInZone(date, timeZone) || {
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds(),
    };
    const h = p.hour % 12;
    const m = p.minute;
    const s = p.second;
    return {
      hour: (h + m / 60) * 30,
      minute: (m + s / 60) * 6,
      second: s * 6,
    };
  }

  function analogSvg(angles, size) {
    const s = size || 120;
    const cx = s / 2;
    const cy = s / 2;
    const r = s * 0.42;
    const hr = s * 0.22;
    const mr = s * 0.32;
    const sr = s * 0.36;
    const rad = (deg) => ((deg - 90) * Math.PI) / 180;
    const line = (len, deg, w, col) => {
      const x2 = cx + len * Math.cos(rad(deg));
      const y2 = cy + len * Math.sin(rad(deg));
      return `<line x1="${cx}" y1="${cy}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
    };
    let ticks = "";
    for (let i = 0; i < 12; i++) {
      const a = i * 30;
      const x1 = cx + r * 0.88 * Math.cos(rad(a));
      const y1 = cy + r * 0.88 * Math.sin(rad(a));
      const x2 = cx + r * Math.cos(rad(a));
      const y2 = cy + r * Math.sin(rad(a));
      ticks += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="rgba(232,196,104,0.35)" stroke-width="2"/>`;
    }
    return `<svg viewBox="0 0 ${s} ${s}" class="analog-svg" aria-hidden="true">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(232,196,104,0.12)" stroke-width="2"/>
      ${ticks}
      ${line(hr, angles.hour, 4, "#e8c468")}
      ${line(mr, angles.minute, 3, "#f0d78a")}
      ${line(sr, angles.second, 1.5, "#f07178")}
      <circle cx="${cx}" cy="${cy}" r="3" fill="#e8c468"/>
    </svg>`;
  }

  function localTimeZone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  root.ClockTime = {
    getAllTimeZones,
    zoneCityName,
    formatInZone,
    getPartsInZone,
    getOffsetLabel,
    clockAngles,
    analogSvg,
    localTimeZone,
    formatTime12: (d, tz) =>
      formatInZone(d, tz, { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true }),
    formatTime24: (d, tz) =>
      formatInZone(d, tz, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }),
    formatDate: (d, tz) =>
      formatInZone(d, tz, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
  };
})(window);