const APP_SETTINGS_SCHEMA = {
  builds: {
    title: "Builds",
    sections: [
      {
        id: "sync",
        label: "Folder sync",
        items: [
          { key: "autoRefreshEnabled", label: "Auto-refresh trees", hint: "Rescan linked project folders in the background", type: "toggle", default: true },
          { key: "autoRefreshMinutes", label: "Refresh interval", hint: "Minutes between automatic tree scans", type: "select", default: 3, options: [1, 2, 3, 5, 10, 15, 30] },
          { key: "watchFolderDefault", label: "Watch new projects", hint: "Enable auto-refresh when linking a folder", type: "toggle", default: true },
        ],
      },
      {
        id: "ui",
        label: "Display",
        items: [
          { key: "showTreeCounts", label: "Tree file counts", hint: "Show file & folder counts in the code tree", type: "toggle", default: true },
          { key: "confirmDelete", label: "Confirm delete", hint: "Ask before removing a project", type: "toggle", default: true },
          {
            key: "mslIcons",
            label: "Icon Library via My Space Link",
            hint: "Choose Lucide icons for projects through MSL. Turn off to roll back to emoji-only icons.",
            type: "toggle",
            default: true,
            whenOff: "msl-icons-off",
          },
        ],
      },
      {
        id: "msl",
        label: "My Space Link",
        items: [
          {
            key: "mslProvider",
            label: "Publish Builds over MSL",
            hint: "Allow other apps to list/create projects via MSL. Turn off to roll back.",
            type: "toggle",
            default: true,
          },
        ],
      },
    ],
  },
  drift: {
    title: "Drift",
    sections: [
      {
        id: "scan",
        label: "Activity scan",
        items: [
          { key: "backgroundScan", label: "Background scan", hint: "Watch zones for file changes while My Space runs", type: "toggle", default: true },
          { key: "scanIntervalMinutes", label: "Scan interval", hint: "Minutes between zone scans", type: "select", default: 5, options: [1, 2, 5, 10, 15, 30] },
          { key: "desktopNotifications", label: "Desktop alerts", hint: "Notify on notable file activity", type: "toggle", default: false },
        ],
      },
    ],
  },
  stocks: {
    title: "Stocks",
    sections: [
      {
        id: "quotes",
        label: "Market data",
        items: [
          { key: "autoRefresh", label: "Auto-refresh quotes", hint: "Update prices while the app is open", type: "toggle", default: true },
          { key: "refreshSeconds", label: "Quote interval", hint: "Seconds between price updates (default 3 min)", type: "select", default: 180, options: [60, 120, 180, 300] },
          { key: "showAfterHours", label: "After-hours data", hint: "Include extended hours when available", type: "toggle", default: false },
        ],
      },
      {
        id: "appearance",
        label: "Appearance",
        items: [
          {
            key: "uiLayout",
            label: "UI layout",
            hint: "Organized = new layout. Classic = exact previous look.",
            type: "select",
            default: "organized",
            options: ["organized", "classic"],
          },
        ],
      },
      {
        id: "language",
        label: "Language",
        items: [
          {
            key: "uiLanguage",
            label: "Interface language",
            hint: "Follow My Space display language, or force English / Hebrew (RTL)",
            type: "select",
            default: "system",
            options: ["system", "en", "he", "ar", "fr", "ru", "es"],
            hint: "Follow My Space display language, or force a specific language (RTL when needed)",
          },
        ],
      },
      {
        id: "msl",
        label: "My Space Link",
        items: [
          {
            key: "mslProvider",
            label: "Publish Stocks over MSL",
            hint: "Allow other apps to fetch quotes and watchlists via MSL. Turn off to roll back.",
            type: "toggle",
            default: true,
          },
        ],
      },
    ],
  },
  contacts: {
    title: "Contacts",
    sections: [
      {
        id: "reminders",
        label: "Reminders",
        items: [
          { key: "birthdayReminders", label: "Birthday reminders", hint: "Desktop notifications for upcoming birthdays", type: "toggle", default: true },
          { key: "reminderDaysBefore", label: "Remind days before", hint: "How early to alert before a birthday", type: "select", default: 1, options: [0, 1, 3, 7] },
        ],
      },
      {
        id: "msl",
        label: "My Space Link",
        items: [
          {
            key: "mslProvider",
            label: "Publish Contacts over MSL",
            hint: "Allow other apps to list contacts and open email/phone via MSL. Turn off to roll back.",
            type: "toggle",
            default: true,
          },
        ],
      },
    ],
  },
  notes: {
    title: "Notes",
    sections: [
      {
        id: "msl",
        label: "My Space Link",
        items: [
          {
            key: "mslProvider",
            label: "Publish Notes over MSL",
            hint: "Allow other apps to list, search, and add notes via MSL. Turn off to roll back.",
            type: "toggle",
            default: true,
          },
        ],
      },
    ],
  },
  contracts: {
    title: "Contracts",
    sections: [
      {
        id: "alerts",
        label: "Expiry alerts",
        items: [
          { key: "expiryNotifications", label: "Expiry notifications", hint: "Alert when contracts are ending soon", type: "toggle", default: true },
          { key: "expiryDaysAhead", label: "Days ahead", hint: "How many days before expiry to warn", type: "select", default: 30, options: [7, 14, 30, 60, 90] },
        ],
      },
    ],
  },
  "shell-console": {
    title: "Console",
    sections: [
      {
        id: "engine",
        label: "Command engine",
        items: [
          { key: "saveHistory", label: "Save history", hint: "Keep command history between sessions", type: "toggle", default: true },
          { key: "syncFromDesktop", label: "Sync shell config", hint: "Merge shortcuts from desktop shell on open", type: "toggle", default: true },
          { key: "confirmClear", label: "Confirm clear", hint: "Ask before clearing history or rules", type: "toggle", default: true },
        ],
      },
    ],
  },
  translate: {
    title: "Translate",
    sections: [
      {
        id: "behavior",
        label: "Translation",
        items: [
          { key: "saveHistory", label: "Save history", hint: "Remember recent translations", type: "toggle", default: true },
          { key: "autoDetect", label: "Auto-detect language", hint: "Guess source language automatically", type: "toggle", default: true },
        ],
      },
      {
        id: "msl",
        label: "My Space Link",
        items: [
          {
            key: "mslProvider",
            label: "Publish Translate over MSL",
            hint: "Allow other apps to translate text via MSL. Turn off to roll back.",
            type: "toggle",
            default: true,
          },
        ],
      },
    ],
  },
  profiles: {
    title: "Vault",
    sections: [
      {
        id: "vault",
        label: "Vault",
        items: [
          { key: "vaultLockMinutes", label: "Auto-lock vault", hint: "Minutes idle before vault locks", type: "select", default: 15, options: [5, 15, 30, 60, 0] },
          { key: "maskSecrets", label: "Mask secrets", hint: "Hide vault values until revealed", type: "toggle", default: true },
        ],
      },
    ],
  },
  "world-clock": {
    title: "Clock",
    sections: [
      {
        id: "display",
        label: "Clock display",
        items: [
          { key: "use24Hour", label: "24-hour format", hint: "Show times in 24h instead of AM/PM", type: "toggle", default: false },
          { key: "showSeconds", label: "Show seconds", hint: "Include seconds on live clocks", type: "toggle", default: true },
          { key: "soundAlerts", label: "Timer sounds", hint: "Play sound when timer or pomodoro ends", type: "toggle", default: true },
        ],
      },
      {
        id: "msl",
        label: "My Space Link",
        items: [
          {
            key: "mslProvider",
            label: "Publish Clock over MSL",
            hint: "Allow other apps to read favorites and trigger focus via MSL. Turn off to roll back.",
            type: "toggle",
            default: true,
          },
        ],
      },
    ],
  },
  geography: {
    title: "Geography",
    sections: [
      {
        id: "explore",
        label: "Explore",
        items: [
          {
            key: "richProfiles",
            label: "Rich country profiles",
            hint: "Load detailed learn-mode content",
            type: "toggle",
            default: true,
            whenOff: "geo-lite-profiles",
          },
          {
            key: "showFlags",
            label: "Show flags",
            hint: "Display country flags in lists and detail views",
            type: "toggle",
            default: true,
            whenOff: "geo-hide-flags",
          },
        ],
      },
      {
        id: "msl",
        label: "My Space Link",
        items: [
          {
            key: "mslProvider",
            label: "Publish Geography over MSL",
            hint: "Allow other apps to list countries and learn profiles via MSL. Turn off to roll back.",
            type: "toggle",
            default: true,
          },
        ],
      },
    ],
  },
  space: {
    title: "Space",
    sections: [
      {
        id: "viewer",
        label: "Viewer",
        items: [
          { key: "lowGraphics", label: "Low graphics mode", hint: "Reduce animations for slower machines", type: "toggle", default: false },
          { key: "autoFetchNasa", label: "Auto-load NASA", hint: "Fetch NASA imagery when opening NASA Lab", type: "toggle", default: true },
        ],
      },
      {
        id: "msl",
        label: "My Space Link",
        items: [
          {
            key: "mslProvider",
            label: "Publish Space over MSL",
            hint: "Allow other apps to search bodies and open Space links. Turn off to roll back.",
            type: "toggle",
            default: true,
          },
        ],
      },
    ],
  },
  studies: {
    title: "Studies",
    sections: [
      {
        id: "docs",
        label: "Documents",
        items: [
          { key: "autosave", label: "Autosave", hint: "Save document edits automatically", type: "toggle", default: true },
          { key: "spellCheck", label: "Spell check hints", hint: "Underline possible spelling issues", type: "toggle", default: false },
          {
            key: "formalStudio",
            label: "Formal documents (phase 1)",
            hint: "Continuous formal editor, style presets, and DOCX export. Turn off to roll back to classic visual Studies only.",
            type: "toggle",
            default: true,
            whenOff: "formal-studio-off",
          },
        ],
      },
      {
        id: "msl",
        label: "My Space Link",
        items: [
          {
            key: "mslProvider",
            label: "Publish Studies over MSL",
            hint: "Allow other apps to list documents and export via MSL. Turn off to roll back.",
            type: "toggle",
            default: true,
          },
        ],
      },
    ],
  },
  "remote-hub": {
    title: "Remote Hub",
    sections: [
      {
        id: "connections",
        label: "Connections",
        items: [
          { key: "connectionTimeout", label: "Timeout (seconds)", hint: "Give up if host does not respond", type: "select", default: 30, options: [15, 30, 60, 120] },
          { key: "savePasswords", label: "Remember passwords", hint: "Store connection passwords locally", type: "toggle", default: false },
        ],
      },
    ],
  },
  history: {
    title: "History",
    sections: [
      {
        id: "timeline",
        label: "Timeline",
        items: [
          { key: "compactTimeline", label: "Compact timeline", hint: "Denser event rows in the feed", type: "toggle", default: false },
          { key: "showImages", label: "Show thumbnails", hint: "Load preview images when available", type: "toggle", default: true },
        ],
      },
      {
        id: "msl",
        label: "My Space Link",
        items: [
          {
            key: "mslProvider",
            label: "Publish History over MSL",
            hint: "Allow other apps to list figures/events via MSL. Turn off to roll back.",
            type: "toggle",
            default: true,
          },
        ],
      },
    ],
  },
  "code-lexicon": {
    title: "Code Lexicon",
    sections: [
      {
        id: "reading",
        label: "Reading",
        items: [
          { key: "showExamples", label: "Show examples", hint: "Display code examples on term cards", type: "toggle", default: true },
          { key: "largeText", label: "Large text", hint: "Increase definition font size", type: "toggle", default: false },
        ],
      },
    ],
  },
  "system-info": {
    title: "System Info",
    sections: [
      {
        id: "metrics",
        label: "Metrics",
        items: [
          { key: "autoSample", label: "Auto-sample metrics", hint: "Record CPU/RAM samples in Performance Lab", type: "toggle", default: true },
          { key: "sampleIntervalSec", label: "Sample interval", hint: "Seconds between metric samples", type: "select", default: 5, options: [2, 5, 10, 30] },
          { key: "hideSystemProcesses", label: "Hide system processes", hint: "Filter low-level Windows processes", type: "toggle", default: false },
        ],
      },
    ],
  },
  "flag-quiz": {
    title: "Learning Games",
    sections: [
      {
        id: "language",
        label: "Language",
        items: [
          {
            key: "uiLanguage",
            label: "Interface language",
            hint: "Follow My Space display language, or force English / Hebrew (RTL)",
            type: "select",
            default: "system",
            options: ["system", "en", "he", "ar", "fr", "ru", "es"],
            hint: "Follow My Space display language, or force a specific language (RTL when needed)",
          },
        ],
      },
    ],
  },
  "pi-digits": {
    title: "Pi Digits",
    sections: [
      {
        id: "practice",
        label: "Practice",
        items: [
          {
            key: "targetDigits",
            label: "Target digits",
            hint: "How far you aim to memorize",
            type: "select",
            default: 280,
            options: [50, 100, 150, 200, 280, 300, 500],
          },
          {
            key: "defaultChunkSize",
            label: "Digits per lesson",
            hint: "How many new digits to learn at a time",
            type: "select",
            default: 4,
            options: [3, 4, 5],
          },
        ],
      },
    ],
  },
  "icon-library": {
    title: "Icon Library",
    sections: [
      {
        id: "preview",
        label: "Preview defaults",
        items: [
          {
            key: "defaultSize",
            label: "Default preview size",
            hint: "Starting size in the preview panel",
            type: "select",
            default: 48,
            options: [24, 32, 48, 64, 96],
          },
        ],
      },
      {
        id: "msl",
        label: "My Space Link",
        items: [
          {
            key: "mslProvider",
            label: "Publish icons over MSL",
            hint: "Allow other apps to search and pick icons. Turn off to roll back Icon Library as an MSL provider.",
            type: "toggle",
            default: true,
          },
        ],
      },
    ],
  },
  "apps-info": {
    title: "Info",
    sections: [
      {
        id: "msl",
        label: "My Space Link",
        items: [
          {
            key: "mslProvider",
            label: "Publish app catalog over MSL",
            hint: "Allow other apps to list apps and digests via MSL. Turn off to roll back.",
            type: "toggle",
            default: true,
          },
        ],
      },
    ],
  },
  docs: {
    title: "Docs",
    sections: [
      {
        id: "reading",
        label: "Reading",
        items: [
          {
            key: "restoreLastPage",
            label: "Restore last page",
            hint: "Reopen the article you were reading",
            type: "toggle",
            default: true,
          },
        ],
      },
    ],
  },
  "world-maps": {
    title: "World Maps",
    sections: [
      {
        id: "msl",
        label: "My Space Link",
        items: [
          {
            key: "mslProvider",
            label: "Publish World Maps over MSL",
            hint: "Allow other apps to geocode and read notes/routes via MSL. Turn off to roll back.",
            type: "toggle",
            default: true,
          },
        ],
      },
    ],
  },
  "day-planner": {
    title: "Today",
    sections: [
      {
        id: "msl",
        label: "My Space Link",
        items: [
          {
            key: "mslProvider",
            label: "Publish Today over MSL",
            hint: "Allow other apps to list/add tasks via MSL. Turn off to roll back.",
            type: "toggle",
            default: true,
          },
        ],
      },
    ],
  },
  tasks: {
    title: "Tasks",
    sections: [],
  },
  chat: {
    title: "Chat",
    sections: [],
  },
  coupons: {
    title: "Coupons",
    sections: [],
  },
  "study-deck": {
    title: "Study Deck",
    sections: [],
  },
};

const APP_UI_LANGUAGE_SECTION = {
  id: "language",
  label: "Language",
  items: [
    {
      key: "uiLanguage",
      label: "Interface language",
      hint: "Follow My Space display language, or force a specific language (RTL when needed)",
      type: "select",
      default: "system",
      options: ["system", "en", "he", "ar", "fr", "ru", "es"],
    },
  ],
};

const PRODUCT_APP_LANGUAGE_IDS = [
  "builds",
  "chat",
  "code-lexicon",
  "contacts",
  "contracts",
  "coupons",
  "day-planner",
  "docs",
  "drift",
  "flag-quiz",
  "geography",
  "history",
  "icon-library",
  "notes",
  "pi-digits",
  "profiles",
  "remote-hub",
  "space",
  "stocks",
  "studies",
  "study-deck",
  "tasks",
  "translate",
  "world-clock",
  "world-maps",
];

function ensureProductAppLanguageSections() {
  for (const id of PRODUCT_APP_LANGUAGE_IDS) {
    if (!APP_SETTINGS_SCHEMA[id]) {
      APP_SETTINGS_SCHEMA[id] = { title: id, sections: [] };
    }
    const app = APP_SETTINGS_SCHEMA[id];
    if (!Array.isArray(app.sections)) app.sections = [];
    const existing = app.sections.find((s) => s.id === "language");
    if (existing) {
      const item = (existing.items || []).find((i) => i.key === "uiLanguage" || i.key === "language");
      if (item) {
        item.key = "uiLanguage";
        item.default = item.default === "en" || item.default === "he" ? item.default : "system";
        if (!["system", "en", "he", "ar", "fr", "ru", "es"].includes(item.default)) item.default = "system";
        item.options = [...APP_UI_LANGUAGE_SECTION.items[0].options];
        item.hint = APP_UI_LANGUAGE_SECTION.items[0].hint;
        item.label = APP_UI_LANGUAGE_SECTION.items[0].label;
      } else {
        existing.items = [...(existing.items || []), ...APP_UI_LANGUAGE_SECTION.items];
      }
      continue;
    }
    app.sections.unshift(JSON.parse(JSON.stringify(APP_UI_LANGUAGE_SECTION)));
  }
}

ensureProductAppLanguageSections();

function coerceSettingValue(item, value) {
  if (!item) return value;
  if (item.type === "toggle") return value === true || value === "true";
  if (item.type === "select" && item.options?.every((o) => typeof o === "number")) {
    const n = Number(value);
    return Number.isFinite(n) ? n : item.default;
  }
  return value;
}

function mergeAppSettings(schema, raw) {
  const src = raw && typeof raw === "object" ? { ...raw } : {};
  if (
    src.uiLanguage == null &&
    typeof src.language === "string" &&
    ["en", "he", "ar", "fr", "ru", "es", "system"].includes(src.language)
  ) {
    src.uiLanguage = src.language;
  }
  const out = {};
  for (const sec of schema?.sections || []) {
    for (const item of sec.items || []) {
      const has = Object.prototype.hasOwnProperty.call(src, item.key);
      out[item.key] = coerceSettingValue(item, has ? src[item.key] : item.default);
    }
  }
  return out;
}

function allEffectClasses(schemaMap) {
  const set = new Set();
  const map = schemaMap || APP_SETTINGS_SCHEMA;
  for (const app of Object.values(map)) {
    for (const sec of app.sections || []) {
      for (const item of sec.items || []) {
        if (item.whenOff) set.add(item.whenOff);
        if (item.whenOn) set.add(item.whenOn);
      }
    }
  }
  return set;
}

function toggleIsOn(value, defaultValue = true) {
  if (value === undefined || value === null) return defaultValue !== false;
  return value !== false && value !== "false" && value !== 0 && value !== "0";
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { APP_SETTINGS_SCHEMA, mergeAppSettings, allEffectClasses, coerceSettingValue, toggleIsOn };
}

if (typeof window !== "undefined") {
  window.APP_SETTINGS_SCHEMA = APP_SETTINGS_SCHEMA;
  window.mergeAppSettings = mergeAppSettings;
  window.allEffectClasses = allEffectClasses;
  window.toggleIsOn = toggleIsOn;
}