window.WMi18n = (function () {
  const STRINGS = {
    en: {
      brandSub: "Explore the world",
      searchPlaceholder: "Search city, country, address…",
      searchGo: "Go",
      profiles: "Profiles",
      locateMe: "⊕ Locate me",
      world: "World",
      mapHint: "Drag to pan · Scroll to zoom · Double-click to zoom in · Right-click to add a note",
      ctxAddNote: "📝 Add note here",
      ctxCopyCoords: "📋 Copy coordinates",
      profilesTitle: "Country profiles",
      profilesSearchPlaceholder: "Search country — e.g. Pakistan, Israel, FR…",
      statusPlaceDefault: "Click the map or search a place",
      zoom: "Zoom",
      addNoteTitle: "Add map note",
      categoryLegend: "Category",
      noteTitleLabel: "Title",
      noteTitlePlaceholder: "e.g. Sunset viewpoint",
      cancel: "Cancel",
      saveNote: "Save note",
      settings: "Settings",
      logout: "Sign out",
      logoutConfirm: "Sign out of World Maps?",
      settingsTitle: "Control Panel",
      settingsBadge: "World Maps",
      settingsNote: "Flip a switch — ON keeps the feature active, OFF turns it off.",
      settingsSectionGeneral: "General",
      settingsSectionMap: "Map",
      language: "Language",
      languageHint: "Menus, labels, and place-name search (Hebrew queries supported)",
      langEn: "English",
      langHe: "Hebrew",
      toggleOn: "ON",
      toggleOff: "OFF",
      showMapHint: "Map tips bar",
      showMapHintHint: "Show the help bar at the bottom of the map",
      showNoteLabels: "Note titles on map",
      showNoteLabelsHint: "Show note names on the map when zoomed in",
      showZoomControls: "Zoom buttons",
      showZoomControlsHint: "Show + / − / compass on the map",
      confirmDelete: "Confirm delete",
      confirmDeleteHint: "Ask before deleting a map note",
      resetDefaults: "Reset defaults",
      resetConfirm: "Reset all settings to defaults?",
      saving: "Saving…",
      profilesEmpty: "No markers yet.<br>Add your first place by address below, or right-click the map.",
      profilesNoMatch: "No countries match your search.",
      markers: "markers",
      marker: "marker",
      viewOnMap: "View on map",
      deleteAllInCountry: "Delete all in country",
      goHere: "Go here",
      delete: "Delete",
      deleteNoteConfirm: 'Delete note "{title}"?',
      deleteAllConfirm: "Delete all {count} markers in {country}?",
      coordsCopied: "Coordinates copied",
      noteAdded: "Note added: {title}",
      searching: "Searching…",
      noPlaces: "No places found",
      searchFailed: "Search failed",
      worldView: "World view",
      yourLocation: "Your location",
      findingLocation: "Finding your location…",
      geolocationUnavailable: "Geolocation is not available",
      geolocationFailed: "Could not get your location",
      lookingUpPlace: "Looking up place…",
      zoomIn: "Zoom in",
      zoomOut: "Zoom out",
      resetBearing: "Reset bearing",
      close: "Close",
      back: "Back",
      signedIn: "Signed in",
      catTrail: "Trail",
      catNature: "Nature",
      catHotel: "Hotel",
      catBeach: "Beach",
      catAttraction: "Attraction",
      catRestaurant: "Restaurant",
      unknownCountry: "Unknown",
      profileAddByAddress: "Add by address",
      profileAddressLabel: "Exact address",
      profileAddressPlaceholder: "Address",
      profileAddressTitlePlaceholder: "Title",
      profileAddMarker: "Add marker",
      profileAdding: "Looking up address…",
      profilePickFromList: "Pick an address from the list",
      profileAddressSelected: "Location selected — add a title (optional), then click Add marker",
      profileAddressAdded: "Added: {title}",
    },
    he: {
      brandSub: "גלו את העולם",
      searchPlaceholder: "חיפוש עיר, מדינה, כתובת…",
      searchGo: "חפש",
      profiles: "פרופילים",
      locateMe: "⊕ המיקום שלי",
      world: "עולם",
      mapHint: "גרור לניווט · גלגלת לזום · לחיצה כפולה לזום · קליק ימני להוספת הערה",
      ctxAddNote: "📝 הוסף הערה כאן",
      ctxCopyCoords: "📋 העתק קואורדינטות",
      profilesTitle: "פרופילי מדינות",
      profilesSearchPlaceholder: "חיפוש מדינה — למשל ישראל, France, JP…",
      statusPlaceDefault: "לחץ על המפה או חפש מקום",
      zoom: "זום",
      addNoteTitle: "הוספת הערה למפה",
      categoryLegend: "קטגוריה",
      noteTitleLabel: "כותרת",
      noteTitlePlaceholder: "למשל נקודת תצפית",
      cancel: "ביטול",
      saveNote: "שמור הערה",
      settings: "הגדרות",
      logout: "יציאה",
      logoutConfirm: "לצאת מ-World Maps?",
      settingsTitle: "לוח בקרה",
      settingsBadge: "מפת העולם",
      settingsNote: "הפעל/כבה מתג — פועל = מופעל, כבוי = מכובה.",
      settingsSectionGeneral: "כללי",
      settingsSectionMap: "מפה",
      language: "שפה",
      languageHint: "תפריטים, תוויות וחיפוש שמות מקומות (כולל שאילתות בעברית)",
      langEn: "English",
      langHe: "עברית",
      toggleOn: "פועל",
      toggleOff: "כבוי",
      showMapHint: "שורת טיפים",
      showMapHintHint: "הצג את שורת העזרה בתחתית המפה",
      showNoteLabels: "כותרות הערות על המפה",
      showNoteLabelsHint: "הצג שמות הערות על המפה בזום קרוב",
      showZoomControls: "כפתורי זום",
      showZoomControlsHint: "הצג + / − / מצפן על המפה",
      confirmDelete: "אישור מחיקה",
      confirmDeleteHint: "שאל לפני מחיקת הערה",
      resetDefaults: "איפוס לברירת מחדל",
      resetConfirm: "לאפס את כל ההגדרות לברירת מחדל?",
      saving: "שומר…",
      profilesEmpty: "אין סימונים עדיין.<br>הוסף מקום ראשון לפי כתובת למטה, או קליק ימני על המפה.",
      profilesNoMatch: "אין מדינות שמתאימות לחיפוש.",
      markers: "סימונים",
      marker: "סימון",
      viewOnMap: "הצג במפה",
      deleteAllInCountry: "מחק הכל במדינה",
      goHere: "עבור לכאן",
      delete: "מחק",
      deleteNoteConfirm: 'למחוק את "{title}"?',
      deleteAllConfirm: "למחוק את כל {count} הסימונים ב-{country}?",
      coordsCopied: "קואורדינטות הועתקו",
      noteAdded: "הערה נוספה: {title}",
      searching: "מחפש…",
      noPlaces: "לא נמצאו מקומות",
      searchFailed: "החיפוש נכשל",
      worldView: "תצוגת עולם",
      yourLocation: "המיקום שלך",
      findingLocation: "מאתר מיקום…",
      geolocationUnavailable: "מיקום לא זמין",
      geolocationFailed: "לא ניתן לקבל מיקום",
      lookingUpPlace: "מחפש מקום…",
      zoomIn: "הגדל",
      zoomOut: "הקטן",
      resetBearing: "אפס כיוון",
      close: "סגור",
      back: "חזרה",
      signedIn: "מחובר",
      catTrail: "שביל",
      catNature: "טבע",
      catHotel: "מלון",
      catBeach: "חוף",
      catAttraction: "אטרקציה",
      catRestaurant: "מסעדה",
      unknownCountry: "לא ידוע",
      profileAddByAddress: "הוסף לפי כתובת",
      profileAddressLabel: "כתובת מדויקת",
      profileAddressPlaceholder: "כתובת",
      profileAddressTitlePlaceholder: "כותרת",
      profileAddMarker: "הוסף סימון",
      profileAdding: "מחפש כתובת…",
      profilePickFromList: "בחר כתובת מהרשימה",
      profileAddressSelected: "המיקום נבחר — הוסף כותרת (אופציונלי) ולחץ הוסף סימון",
      profileAddressAdded: "נוסף: {title}",
    },
  };

  const CATEGORY_KEYS = {
    trail: "catTrail",
    nature: "catNature",
    hotel: "catHotel",
    beach: "catBeach",
    attraction: "catAttraction",
    restaurant: "catRestaurant",
  };

  let onApply = null;

  function lang() {
    return window.WMSettings?.get?.("language") || "en";
  }

  function t(key, vars) {
    const table = STRINGS[lang()] || STRINGS.en;
    let s = table[key] ?? STRINGS.en[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return s;
  }

  function categoryLabel(id) {
    const key = CATEGORY_KEYS[id];
    return key ? t(key) : id;
  }

  function applyDom() {
    const l = lang();
    document.documentElement.lang = l;
    document.documentElement.dir = "ltr";
    document.body.classList.toggle("ui-he", l === "he");

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.dataset.i18n;
      const val = t(key);
      if (el.dataset.i18nAttr === "placeholder") el.placeholder = val;
      else if (el.dataset.i18nAttr === "title") el.title = val;
      else if (el.dataset.i18nAttr === "aria-label") el.setAttribute("aria-label", val);
      else if (el.dataset.i18nHtml === "1") el.innerHTML = val;
      else el.textContent = val;
    });

    onApply?.();
  }

  function setOnApply(fn) {
    onApply = fn;
  }

  return { t, applyDom, lang, categoryLabel, setOnApply, CATEGORY_KEYS };
})();
