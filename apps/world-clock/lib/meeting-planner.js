(function (root) {
  const { pad2 } = root.ClockUtils;
  const { getPartsInZone, zoneCityName, localTimeZone } = root.ClockTime;

  const WEEKDAY_MAP = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  function getOffsetMinutes(date, timeZone) {
    try {
      const dtf = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      const parts = dtf.formatToParts(date);
      const map = {};
      parts.forEach((p) => {
        if (p.type !== "literal") map[p.type] = p.value;
      });
      const hour = parseInt(map.hour, 10) % 24;
      const asUtc = Date.UTC(
        parseInt(map.year, 10),
        parseInt(map.month, 10) - 1,
        parseInt(map.day, 10),
        hour,
        parseInt(map.minute, 10),
        parseInt(map.second, 10)
      );
      return Math.round((asUtc - date.getTime()) / 60000);
    } catch (_) {
      return 0;
    }
  }

  function getWeekdayInZone(date, timeZone) {
    try {
      const wd = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
      return WEEKDAY_MAP[wd] ?? 0;
    } catch (_) {
      return date.getDay();
    }
  }

  function findLocalMoment(y, m, d, hour, minute, timeZone) {
    let guess = Date.UTC(y, m - 1, d, hour, minute, 0);
    for (let delta = -16; delta <= 16; delta++) {
      const test = new Date(guess + delta * 3600000);
      const p = getPartsInZone(test, timeZone);
      if (
        p &&
        p.year === y &&
        p.month === m &&
        p.day === d &&
        p.hour === hour &&
        p.minute === minute
      ) {
        return test;
      }
    }
    return new Date(guess);
  }

  function parseDateStr(dateStr) {
    const [y, m, d] = String(dateStr || "")
      .split("-")
      .map((n) => parseInt(n, 10));
    if (!y || !m || !d) return null;
    return { y, m, d };
  }

  function todayDateStr() {
    const n = new Date();
    return `${n.getFullYear()}-${pad2(n.getMonth() + 1)}-${pad2(n.getDate())}`;
  }

  function getDstInfo(date, timeZone) {
    const y = date.getFullYear();
    const jan = getOffsetMinutes(new Date(Date.UTC(y, 0, 15, 12)), timeZone);
    const jul = getOffsetMinutes(new Date(Date.UTC(y, 6, 15, 12)), timeZone);
    const observesDst = jan !== jul;
    const standard = Math.min(jan, jul);
    const current = getOffsetMinutes(date, timeZone);
    const isDstNow = observesDst && current !== standard;

    let nextTransition = null;
    if (observesDst) {
      let prev = current;
      const scan = new Date(date);
      scan.setHours(12, 0, 0, 0);
      for (let i = 1; i <= 400; i++) {
        scan.setDate(scan.getDate() + 1);
        const off = getOffsetMinutes(scan, timeZone);
        if (off !== prev) {
          nextTransition = {
            date: new Date(scan),
            fromOffset: prev,
            toOffset: off,
            enteringDst: off > prev,
          };
          break;
        }
        prev = off;
      }
    }

    return { observesDst, isDstNow, standardOffset: standard, currentOffset: current, nextTransition };
  }

  function formatOffsetLabel(minutes) {
    const sign = minutes >= 0 ? "+" : "-";
    const abs = Math.abs(minutes);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    if (m === 0) return `UTC${sign}${h}`;
    return `UTC${sign}${h}:${pad2(m)}`;
  }

  function participantScore(slotDate, participant, durationMin) {
    const p = participant;
    const tz = p.timezone;
    const parts = getPartsInZone(slotDate, tz);
    if (!parts) return { score: 0, statusLabel: "Unknown", hour: 0 };

    const workStart = clampHour(p.workStart, 9);
    const workEnd = clampHour(p.workEnd, 17);
    const workDays = Array.isArray(p.workDays) ? p.workDays : [1, 2, 3, 4, 5];

    const endSlot = new Date(slotDate.getTime() + durationMin * 60000);
    const endParts = getPartsInZone(endSlot, tz) || parts;

    let minScore = 100;
    let worstLabel = "Work hours";

    const checkInstant = (instParts, dow) => {
      const hour = instParts.hour + instParts.minute / 60;
      let score = 0;
      let label = "Night";

      if (hour >= workStart && hour < workEnd) {
        score = 100;
        label = "Work hours";
      } else if (hour >= workStart - 1 && hour < workEnd + 1) {
        score = 65;
        label = "Edge of work";
      } else if (hour >= 7 && hour < 22) {
        score = 40;
        label = "Awake";
      } else {
        score = 5;
        label = "Night";
      }

      if (workDays.length && !workDays.includes(dow)) {
        score = Math.round(score * 0.45);
        if (label === "Work hours") label = "Weekend";
      }

      return { score, label, hour };
    };

    const dowStart = getWeekdayInZone(slotDate, tz);
    const s0 = checkInstant(parts, dowStart);
    minScore = s0.score;
    worstLabel = s0.label;

    if (endParts.hour !== parts.hour || endParts.minute !== parts.minute) {
      const dowEnd = getWeekdayInZone(endSlot, tz);
      const s1 = checkInstant(endParts, dowEnd);
      if (s1.score < minScore) {
        minScore = s1.score;
        worstLabel = s1.label;
      }
    }

    return {
      score: minScore,
      statusLabel: worstLabel,
      hour: parts.hour,
      localTime: `${pad2(parts.hour)}:${pad2(parts.minute)}`,
    };
  }

  function clampHour(v, fallback) {
    const n = parseInt(v, 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(23, Math.max(0, n));
  }

  function findBestSlots(options) {
    const {
      participants,
      dateStr,
      durationMin = 60,
      referenceTz,
      stepMin = 30,
      maxResults = 8,
    } = options;

    if (!participants?.length) return [];

    const parsed = parseDateStr(dateStr);
    if (!parsed) return [];

    const refTz = referenceTz || localTimeZone();
    const { y, m, d } = parsed;
    const start = findLocalMoment(y, m, d, 0, 0, refTz);
    const end = findLocalMoment(y, m, d, 23, 30, refTz);
    const stepMs = stepMin * 60000;
    const durationMs = durationMin * 60000;

    const slots = [];
    for (let t = start.getTime(); t + durationMs <= end.getTime() + stepMs; t += stepMs) {
      const slotDate = new Date(t);
      const perPerson = participants.map((p) => ({
        id: p.id,
        label: p.label,
        timezone: p.timezone,
        ...participantScore(slotDate, p, durationMin),
      }));
      const minScore = Math.min(...perPerson.map((x) => x.score));
      const avgScore = perPerson.reduce((a, x) => a + x.score, 0) / perPerson.length;

      slots.push({
        start: slotDate,
        score: minScore,
        avgScore,
        allInWork: perPerson.every((x) => x.score >= 100),
        participants: perPerson,
        refLabel: formatSlotInZone(slotDate, refTz),
      });
    }

    slots.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.avgScore - a.avgScore;
    });

    const seen = new Set();
    const unique = [];
    for (const s of slots) {
      const key = s.refLabel;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(s);
      if (unique.length >= maxResults) break;
    }
    return unique;
  }

  function formatSlotInZone(date, timeZone) {
    const p = getPartsInZone(date, timeZone);
    if (!p) return "—";
    return `${pad2(p.hour)}:${pad2(p.minute)}`;
  }

  function friendlyStatus(statusLabel) {
    const map = {
      "Work hours": "Office hours",
      "Edge of work": "Near office hours",
      Awake: "Awake",
      Night: "Likely sleeping",
      Weekend: "Weekend",
      Unknown: "—",
    };
    return map[statusLabel] || statusLabel;
  }

  function slotVerdict(slot) {
    if (slot.allInWork) {
      return {
        level: "great",
        title: "Great for everyone",
        hint: "Everyone is within office hours.",
      };
    }
    if (slot.score >= 65) {
      return {
        level: "ok",
        title: "Good for most",
        hint: "Most people are in or near office hours.",
      };
    }
    return {
      level: "warn",
      title: "OK with caveats",
      hint: "Someone may be early, late, or on a weekend.",
    };
  }

  function formatDateLong(dateStr, timeZone) {
    const parsed = parseDateStr(dateStr);
    if (!parsed) return dateStr;
    const d = findLocalMoment(parsed.y, parsed.m, parsed.d, 12, 0, timeZone);
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone,
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(d);
    } catch (_) {
      return dateStr;
    }
  }

  function formatTimeFriendly(date, timeZone) {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(date);
    } catch (_) {
      return formatSlotInZone(date, timeZone);
    }
  }

  function liveStatusKind(status) {
    if (status === "work") return { pill: "Office hours now", class: "work" };
    if (status === "awake") return { pill: "Awake", class: "awake" };
    return { pill: "Likely sleeping", class: "night" };
  }

  function buildTimelineGrid(options) {
    const { participants, dateStr, referenceTz, durationMin = 60, highlightStart } = options;
    const parsed = parseDateStr(dateStr);
    if (!parsed || !participants?.length) return { hours: [], rows: [] };

    const refTz = referenceTz || localTimeZone();
    const { y, m, d } = parsed;
    const isToday = dateStr === todayDateStr();
    const nowParts = isToday ? getPartsInZone(new Date(), refTz) : null;
    const nowHour = nowParts?.hour ?? null;
    const hours = [];
    const rows = participants.map((p) => ({
      id: p.id,
      label: p.label,
      timezone: p.timezone,
      city: zoneCityName(p.timezone),
      cells: [],
    }));

    for (let h = 0; h < 24; h++) {
      const slotDate = findLocalMoment(y, m, d, h, 0, refTz);
      const hourLabel = `${pad2(h)}:00${nowHour === h ? " · now" : ""}`;
      hours.push(hourLabel);

      rows.forEach((row, ri) => {
        const p = participants[ri];
      const { score, statusLabel } = participantScore(slotDate, p, durationMin);
      let kind = "night";
      if (score >= 100) kind = "work";
      else if (score >= 65) kind = "edge";
      else if (score >= 40) kind = "awake";

      const parts = getPartsInZone(slotDate, p.timezone);
      const localLabel = parts ? `${pad2(parts.hour)}:00` : "—";

      let highlighted = false;
      if (highlightStart) {
        const hi = getPartsInZone(highlightStart, refTz);
        highlighted = hi && hi.hour === h;
      }

        row.cells.push({ kind, statusLabel, localLabel, score, highlighted, isNow: nowHour === h });
      });
    }

    return { hours, rows, referenceTz: refTz };
  }

  function getLiveComparison(now, participants) {
    return participants.map((p) => {
      const parts = getPartsInZone(now, p.timezone);
      const dst = getDstInfo(now, p.timezone);
      const { score, statusLabel } = participantScore(now, p, 30);
      let status = "night";
      if (score >= 100) status = "work";
      else if (score >= 40) status = "awake";

      return {
        id: p.id,
        label: p.label,
        timezone: p.timezone,
        city: zoneCityName(p.timezone),
        time: parts ? `${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}` : "—",
        offset: formatOffsetLabel(dst.currentOffset),
        dstLabel: dst.observesDst
          ? dst.isDstNow
            ? "DST active"
            : "Standard time"
          : "No DST",
        dstDetail: dst.nextTransition
          ? `Next: ${formatTransition(dst.nextTransition)}`
          : dst.observesDst
            ? ""
            : "Fixed offset year-round",
        status,
        statusLabel,
        weekday: new Intl.DateTimeFormat("en-US", { timeZone: p.timezone, weekday: "short" }).format(now),
      };
    });
  }

  function formatTransition(tr) {
    const d = tr.date;
    const dateLabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const dir = tr.enteringDst ? "DST starts" : "DST ends";
    return `${dateLabel} · ${dir}`;
  }

  function defaultParticipant(timezone, label) {
    return {
      id: `mp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timezone,
      label: label || zoneCityName(timezone),
      workStart: 9,
      workEnd: 17,
      workDays: [1, 2, 3, 4, 5],
    };
  }

  function normalizeParticipant(raw) {
    if (!raw || typeof raw.timezone !== "string") return null;
    const workDays = Array.isArray(raw.workDays)
      ? raw.workDays.filter((d) => d >= 0 && d <= 6)
      : [1, 2, 3, 4, 5];
    return {
      id: String(raw.id || raw.timezone),
      timezone: raw.timezone,
      label: String(raw.label || zoneCityName(raw.timezone)),
      workStart: clampHour(raw.workStart, 9),
      workEnd: Math.max(clampHour(raw.workEnd, 17), clampHour(raw.workStart, 9) + 1),
      workDays: workDays.length ? workDays : [1, 2, 3, 4, 5],
    };
  }

  function formatUtcCompact(date) {
    return date
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
  }

  function buildEventDescription(slot, participants, refTz) {
    const lines = (slot?.participants || participants || []).map((pp) => {
      const tz = pp.timezone || refTz;
      const t = slot?.start
        ? formatTimeFriendly(slot.start, tz)
        : "—";
      return `${pp.label}: ${t} (${friendlyStatus(pp.statusLabel || "Work hours")})`;
    });
    return lines.join("\n");
  }

  function buildGoogleCalendarUrl({ title, start, durationMin, description }) {
    const end = new Date(start.getTime() + durationMin * 60000);
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: title || "Meeting",
      dates: `${formatUtcCompact(start)}/${formatUtcCompact(end)}`,
      details: description || "",
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  function buildOutlookCalendarUrl({ title, start, durationMin, description }) {
    const end = new Date(start.getTime() + durationMin * 60000);
    const params = new URLSearchParams({
      subject: title || "Meeting",
      startdt: start.toISOString(),
      enddt: end.toISOString(),
      body: description || "",
      path: "/calendar/action/compose",
      rru: "addevent",
    });
    return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
  }

  function buildIcsContent({ title, start, durationMin, description, uid }) {
    const end = new Date(start.getTime() + durationMin * 60000);
    const stamp = formatUtcCompact(new Date());
    const id = uid || `clock-${start.getTime()}@my-space`;
    const esc = (s) =>
      String(s || "")
        .replace(/\\/g, "\\\\")
        .replace(/\n/g, "\\n")
        .replace(/,/g, "\\,")
        .replace(/;/g, "\\;");
    return [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//My Space Clock//Meeting Planner//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${id}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${formatUtcCompact(start)}`,
      `DTEND:${formatUtcCompact(end)}`,
      `SUMMARY:${esc(title || "Meeting")}`,
      `DESCRIPTION:${esc(description || "")}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
  }

  function downloadIcsFile(icsContent, filename) {
    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "meeting.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  const DEFAULT_PLANNER = {
    participants: [],
    durationMin: 60,
    workStart: 9,
    workEnd: 17,
    defaultTitle: "Meeting",
    scheduled: [],
  };

  root.ClockMeetingPlanner = {
    getOffsetMinutes,
    getDstInfo,
    formatOffsetLabel,
    findBestSlots,
    buildTimelineGrid,
    getLiveComparison,
    defaultParticipant,
    normalizeParticipant,
    todayDateStr,
    parseDateStr,
    formatSlotInZone,
    formatDateLong,
    formatTimeFriendly,
    friendlyStatus,
    slotVerdict,
    liveStatusKind,
    buildEventDescription,
    buildGoogleCalendarUrl,
    buildOutlookCalendarUrl,
    buildIcsContent,
    downloadIcsFile,
    localTimeZone,
    DEFAULT_PLANNER,
  };
})(window);
