(function (root) {
  const THEME_KEY = "myspace-flag-quiz-theme";
  const IMG_CACHE_KEY = "myspace-flag-quiz-animal-thumbs-v4";
  const BAKED = (typeof root !== "undefined" && root.FlagQuizAnimalThumbs) || {};

  const ANIMALS = {
    us: { animal: "Bald eagle", animalHe: "עיטם לבן-ראש", wiki: "Bald eagle" },
    ca: { animal: "North American beaver", animalHe: "בונה צפון-אמריקאי", wiki: "North American beaver" },
    mx: { animal: "Golden eagle", animalHe: "עיט זהוב", wiki: "Golden eagle" },
    br: { animal: "Rufous-bellied thrush", animalHe: "קיכלי בטני-אדום", wiki: "Rufous-bellied thrush" },
    ar: { animal: "Rufous hornero", animalHe: "הורנרו אדום", wiki: "Rufous hornero" },
    cl: { animal: "South Andean deer (huemul)", animalHe: "הומול", wiki: "South Andean deer" },
    pe: { animal: "Vicuña", animalHe: "ויקוןיה", wiki: "Vicuña" },
    co: { animal: "Andean condor", animalHe: "קונדור האנדים", wiki: "Andean condor" },
    ec: { animal: "Andean condor", animalHe: "קונדור האנדים", wiki: "Andean condor" },
    ve: { animal: "Venezuelan troupial", animalHe: "טרופיאל ונצואלי", wiki: "Venezuelan troupial" },
    uy: { animal: "Southern lapwing", animalHe: "טטראס דרומי", wiki: "Southern lapwing" },
    bo: { animal: "Llama", animalHe: "לאמה", wiki: "Llama" },
    py: { animal: "Pampas fox", animalHe: "שועל הפמפס", wiki: "Pampas fox" },
    gy: { animal: "Jaguar", animalHe: "יגואר", wiki: "Jaguar" },
    sr: { animal: "Jaguar", animalHe: "יגואר", wiki: "Jaguar" },
    gt: { animal: "Resplendent quetzal", animalHe: "קצאל זוהר", wiki: "Resplendent quetzal" },
    cr: { animal: "White-tailed deer", animalHe: "אייל לבן-זנב", wiki: "White-tailed deer" },
    pa: { animal: "Harpy eagle", animalHe: "עיט הרפיה", wiki: "Harpy eagle" },
    hn: { animal: "White-tailed deer", animalHe: "אייל לבן-זנב", wiki: "White-tailed deer" },
    ni: { animal: "Turquoise-browed motmot", animalHe: "מוטמוט כחול-גבות", wiki: "Turquoise-browed motmot" },
    sv: { animal: "Turquoise-browed motmot", animalHe: "טורוגוס", wiki: "Turquoise-browed motmot" },
    bz: { animal: "Baird's tapir", animalHe: "טפיר של ביירד", wiki: "Baird's tapir" },
    cu: { animal: "Cuban trogon", animalHe: "טרוגון קובני", wiki: "Cuban trogon" },
    jm: { animal: "Red-billed streamertail", animalHe: "יונק דבש של ג'מייקה", wiki: "Red-billed streamertail" },
    ht: { animal: "Hispaniolan trogon", animalHe: "טרוגון היספניולי", wiki: "Hispaniolan trogon" },
    do: { animal: "Palmchat", animalHe: "פאלמצ'ט", wiki: "Palmchat" },
    tt: { animal: "Scarlet ibis", animalHe: "איביס ארגמן", wiki: "Scarlet ibis" },
    bs: { animal: "American flamingo", animalHe: "פלמינגו אמריקאי", wiki: "American flamingo" },
    bb: { animal: "Brown pelican", animalHe: "שקנאי חום", wiki: "Brown pelican" },
    gd: { animal: "Grenada dove", animalHe: "יונת גרנדה", wiki: "Grenada dove" },
    dm: { animal: "Imperial amazon", animalHe: "אמזון אימפריאלי", wiki: "Imperial amazon" },
    lc: { animal: "Saint Lucia amazon", animalHe: "אמזון של סנט לוסיה", wiki: "Saint Lucia amazon" },
    vc: { animal: "Saint Vincent amazon", animalHe: "אמזון של סנט וינסנט", wiki: "Saint Vincent amazon" },
    pr: { animal: "Common coqui", animalHe: "קוקי", wiki: "Common coquí" },
    gb: { animal: "European robin", animalHe: "אדמדם אירופי", wiki: "European robin" },
    ie: { animal: "Irish hare", animalHe: "ארנבת אירית", wiki: "Irish hare" },
    fr: { animal: "Gallic rooster", animalHe: "תרנגול גאלי", wiki: "Chicken" },
    es: { animal: "Spanish Fighting Bull", animalHe: "שור קרב ספרדי", wiki: "Spanish Fighting Bull" },
    pt: { animal: "Portuguese Water Dog", animalHe: "כלב מים פורטוגזי", wiki: "Portuguese Water Dog" },
    it: { animal: "Italian wolf", animalHe: "זאב איטלקי", wiki: "Italian wolf" },
    gr: { animal: "Common dolphin", animalHe: "דולפין מצוי", wiki: "Common dolphin" },
    de: { animal: "Federal eagle (golden eagle)", animalHe: "עיט זהוב", wiki: "Golden eagle" },
    pl: { animal: "White-tailed eagle", animalHe: "עיטם לבן-זנב", wiki: "White-tailed eagle" },
    sk: { animal: "Brown bear", animalHe: "דוב חום", wiki: "Brown bear" },
    hu: { animal: "Turul (saker falcon)", animalHe: "טורול (בז)", wiki: "Saker falcon" },
    ro: { animal: "Eurasian lynx", animalHe: "שונר אירואסייתי", wiki: "Eurasian lynx" },
    rs: { animal: "Gray wolf", animalHe: "זאב אפור", wiki: "Gray wolf" },
    hr: { animal: "European pine marten", animalHe: "סמור אורנים", wiki: "European pine marten" },
    si: { animal: "Lipizzan", animalHe: "ליפיצן", wiki: "Lipizzan" },
    ba: { animal: "Tornjak", animalHe: "טורניאק", wiki: "Tornjak" },
    al: { animal: "Golden eagle", animalHe: "עיט זהוב", wiki: "Golden eagle" },
    me: { animal: "Golden eagle", animalHe: "עיט זהוב", wiki: "Golden eagle" },
    xk: { animal: "Eurasian lynx", animalHe: "שונר", wiki: "Eurasian lynx" },
    ua: { animal: "Common nightingale", animalHe: "זמיר", wiki: "Common nightingale" },
    by: { animal: "European bison", animalHe: "ביזון אירופי", wiki: "European bison" },
    lt: { animal: "White stork", animalHe: "חסידה לבנה", wiki: "White stork" },
    lv: { animal: "White wagtail", animalHe: "נחליאלי לבן", wiki: "White wagtail" },
    ee: { animal: "Barn swallow", animalHe: "סנונית אסם", wiki: "Barn swallow" },
    fi: { animal: "Brown bear", animalHe: "דוב חום", wiki: "Brown bear" },
    se: { animal: "Moose", animalHe: "אייל קורא", wiki: "Moose" },
    no: { animal: "Moose", animalHe: "אייל קורא", wiki: "Moose" },
    dk: { animal: "Mute swan", animalHe: "ברבור אילם", wiki: "Mute swan" },
    is: { animal: "Gyrfalcon", animalHe: "בז גיר", wiki: "Gyrfalcon" },
    ch: { animal: "Alpine ibex", animalHe: "יעל האלפים", wiki: "Alpine ibex" },
    at: { animal: "Alpine ibex", animalHe: "יעל האלפים", wiki: "Alpine ibex" },
    li: { animal: "Common kestrel", animalHe: "בז מצוי", wiki: "Common kestrel" },
    mt: { animal: "Blue rock thrush", animalHe: "קיכלי כחול", wiki: "Blue rock thrush" },
    cy: { animal: "Cypriot mouflon", animalHe: "מופלון קפריסאי", wiki: "Mouflon" },
    ru: { animal: "Brown bear", animalHe: "דוב חום", wiki: "Brown bear" },
    il: { animal: "Hoopoe", animalHe: "דוכיפת", wiki: "Hoopoe" },
    jo: { animal: "Arabian oryx", animalHe: "ראם ערבי", wiki: "Arabian oryx" },
    sa: { animal: "Arabian camel", animalHe: "גמל חד-דבשתי", wiki: "Dromedary" },
    ae: { animal: "Arabian oryx", animalHe: "ראם ערבי", wiki: "Arabian oryx" },
    qa: { animal: "Arabian oryx", animalHe: "ראם ערבי", wiki: "Arabian oryx" },
    bh: { animal: "Arabian oryx", animalHe: "ראם ערבי", wiki: "Arabian oryx" },
    om: { animal: "Arabian oryx", animalHe: "ראם ערבי", wiki: "Arabian oryx" },
    kw: { animal: "Dromedary", animalHe: "גמל", wiki: "Dromedary" },
    ye: { animal: "Arabian leopard", animalHe: "נמר ערבי", wiki: "Arabian leopard" },
    ir: { animal: "Asiatic cheetah", animalHe: "צ'יטה אסייתית", wiki: "Asiatic cheetah" },
    tr: { animal: "Gray wolf", animalHe: "זאב אפור", wiki: "Gray wolf" },
    az: { animal: "Karabakh horse", animalHe: "סוס קרבאך", wiki: "Karabakh horse" },
    am: { animal: "Armenian mouflon", animalHe: "מופלון ארמני", wiki: "Armenian mouflon" },
    ge: { animal: "Gray wolf", animalHe: "זאב", wiki: "Gray wolf" },
    kz: { animal: "Golden eagle", animalHe: "עיט זהוב", wiki: "Golden eagle" },
    uz: { animal: "Snow leopard", animalHe: "פנתר השלג", wiki: "Snow leopard" },
    kg: { animal: "Snow leopard", animalHe: "פנתר השלג", wiki: "Snow leopard" },
    tj: { animal: "Marco Polo sheep", animalHe: "כבש מרקו פולו", wiki: "Argali" },
    tm: { animal: "Akhal-Teke", animalHe: "אחל-טקה", wiki: "Akhal-Teke" },
    af: { animal: "Snow leopard", animalHe: "פנתר השלג", wiki: "Snow leopard" },
    pk: { animal: "Markhor", animalHe: "מארקהור", wiki: "Markhor" },
    ps: { animal: "Palestine sunbird", animalHe: "צופית ארץ-ישראלית", wiki: "Palestine sunbird" },
    lb: { animal: "Striped hyena", animalHe: "צבוע פסים", wiki: "Striped hyena" },
    sy: { animal: "Syrian brown bear", animalHe: "דוב חום סורי", wiki: "Syrian brown bear" },
    eg: { animal: "Steppe eagle", animalHe: "עיט הערבות", wiki: "Steppe eagle" },
    ma: { animal: "Barbary macaque", animalHe: "מקאק ברברי", wiki: "Barbary macaque" },
    dz: { animal: "Fennec fox", animalHe: "שועל פנק", wiki: "Fennec fox" },
    tn: { animal: "Fennec fox", animalHe: "שועל פנק", wiki: "Fennec fox" },
    ly: { animal: "Fennec fox", animalHe: "שועל פנק", wiki: "Fennec fox" },
    sd: { animal: "Secretarybird", animalHe: "מזכירן", wiki: "Secretarybird" },
    ss: { animal: "African fish eagle", animalHe: "עיטם אפריקאי", wiki: "African fish eagle" },
    et: { animal: "Lion", animalHe: "אריה", wiki: "Lion" },
    er: { animal: "Dromedary", animalHe: "גמל", wiki: "Dromedary" },
    dj: { animal: "Soemmerring's gazelle", animalHe: "גזלה של זומרינג", wiki: "Soemmerring's gazelle" },
    so: { animal: "Leopard", animalHe: "נמר", wiki: "African leopard" },
    ke: { animal: "Lion", animalHe: "אריה", wiki: "Lion" },
    ug: { animal: "Grey crowned crane", animalHe: "עגור מצויץ אפור", wiki: "Grey crowned crane" },
    tz: { animal: "Giraffe", animalHe: "ג'ירף", wiki: "Giraffe" },
    rw: { animal: "Mountain gorilla", animalHe: "גורילת הרים", wiki: "Mountain gorilla" },
    bi: { animal: "Lion", animalHe: "אריה", wiki: "Lion" },
    cd: { animal: "Okapi", animalHe: "אוקפי", wiki: "Okapi" },
    cg: { animal: "African forest elephant", animalHe: "פיל יער אפריקאי", wiki: "African forest elephant" },
    ga: { animal: "African forest elephant", animalHe: "פיל יער אפריקאי", wiki: "African forest elephant" },
    cm: { animal: "Lion", animalHe: "אריה", wiki: "Lion" },
    ng: { animal: "African fish eagle", animalHe: "עיטם אפריקאי", wiki: "African fish eagle" },
    gh: { animal: "African elephant", animalHe: "פיל אפריקאי", wiki: "African bush elephant" },
    ci: { animal: "African elephant", animalHe: "פיל אפריקאי", wiki: "African bush elephant" },
    sn: { animal: "Lion", animalHe: "אריה", wiki: "Lion" },
    ml: { animal: "Lion", animalHe: "אריה", wiki: "Lion" },
    ne: { animal: "Dama gazelle", animalHe: "גזלת דמה", wiki: "Dama gazelle" },
    cf: { animal: "African elephant", animalHe: "פיל אפריקאי", wiki: "African bush elephant" },
    ao: { animal: "Red-crested turaco", animalHe: "טורקו אדום-ציצית", wiki: "Red-crested turaco" },
    zm: { animal: "African fish eagle", animalHe: "עיטם אפריקאי", wiki: "African fish eagle" },
    zw: { animal: "Sable antelope", animalHe: "אנטילופת סייבל", wiki: "Sable antelope" },
    mw: { animal: "Thomson's gazelle", animalHe: "גזלה של תומסון", wiki: "Thomson's gazelle" },
    mz: { animal: "African elephant", animalHe: "פיל אפריקאי", wiki: "African bush elephant" },
    bw: { animal: "Plains zebra", animalHe: "זברת ערבות", wiki: "Plains zebra" },
    na: { animal: "Gemsbok", animalHe: "ראם דרום-אפריקאי", wiki: "Gemsbok" },
    za: { animal: "Springbok", animalHe: "ספרינגבוק", wiki: "Springbok" },
    ls: { animal: "Black rhinoceros", animalHe: "קרנף שחור", wiki: "Black rhinoceros" },
    sz: { animal: "Lion", animalHe: "אריה", wiki: "Lion" },
    mg: { animal: "Ring-tailed lemur", animalHe: "למור טבעתי-זנב", wiki: "Ring-tailed lemur" },
    mu: { animal: "Dodo", animalHe: "דודו", wiki: "Dodo" },
    cv: { animal: "Humpback whale", animalHe: "לוויתן גדול-סנפיר", wiki: "Humpback whale" },
    gq: { animal: "Western lowland gorilla", animalHe: "גורילה", wiki: "Western lowland gorilla" },
    sl: { animal: "Common chimpanzee", animalHe: "שימפנזה", wiki: "Common chimpanzee" },
    gn: { animal: "African elephant", animalHe: "פיל אפריקאי", wiki: "African bush elephant" },
    gw: { animal: "Dugong", animalHe: "תחש הנהרות", wiki: "Dugong" },
    mr: { animal: "Dromedary", animalHe: "גמל", wiki: "Dromedary" },
    eh: { animal: "Dama gazelle", animalHe: "גזלת דמה", wiki: "Dama gazelle" },
    in: { animal: "Bengal tiger", animalHe: "טיגריס בנגלי", wiki: "Bengal tiger" },
    bd: { animal: "Bengal tiger", animalHe: "טיגריס בנגלי", wiki: "Bengal tiger" },
    np: { animal: "Cow", animalHe: "פרה", wiki: "Zebu" },
    bt: { animal: "Takin", animalHe: "טקין", wiki: "Takin" },
    lk: { animal: "Sri Lankan elephant", animalHe: "פיל סרי לנקי", wiki: "Sri Lankan elephant" },
    mv: { animal: "Yellowfin tuna", animalHe: "טונה צהובת-סנפיר", wiki: "Yellowfin tuna" },
    cn: { animal: "Giant panda", animalHe: "פנדה ענק", wiki: "Giant panda" },
    tw: { animal: "Formosan black bear", animalHe: "דוב שחור פורמוזי", wiki: "Formosan black bear" },
    mn: { animal: "Przewalski's horse", animalHe: "סוס פרז'וולסקי", wiki: "Przewalski's horse" },
    jp: { animal: "Green pheasant", animalHe: "פסיון ירוק", wiki: "Green pheasant" },
    kr: { animal: "Siberian tiger", animalHe: "טיגריס סיבירי", wiki: "Siberian tiger" },
    kp: { animal: "Siberian tiger", animalHe: "טיגריס סיבירי", wiki: "Siberian tiger" },
    th: { animal: "Asian elephant", animalHe: "פיל אסייתי", wiki: "Asian elephant" },
    vn: { animal: "Water buffalo", animalHe: "תאו מים", wiki: "Water buffalo" },
    la: { animal: "Asian elephant", animalHe: "פיל אסייתי", wiki: "Asian elephant" },
    mm: { animal: "Indochinese tiger", animalHe: "טיגריס הודו-סין", wiki: "Indochinese tiger" },
    my: { animal: "Malayan tiger", animalHe: "טיגריס מלאני", wiki: "Malayan tiger" },
    id: { animal: "Komodo dragon", animalHe: "דרקון קומודו", wiki: "Komodo dragon" },
    ph: { animal: "Carabao", animalHe: "קרבאו", wiki: "Water buffalo" },
    bn: { animal: "Proboscis monkey", animalHe: "קוף אף", wiki: "Proboscis monkey" },
    tl: { animal: "Saltwater crocodile", animalHe: "תנין ים", wiki: "Saltwater crocodile" },
    au: { animal: "Red kangaroo", animalHe: "קנגורו אדום", wiki: "Red kangaroo" },
    nz: { animal: "Kiwi (bird)", animalHe: "קיווי", wiki: "Kiwi (bird)" },
    pg: { animal: "Raggiana bird-of-paradise", animalHe: "ציפור גן-עדן", wiki: "Raggiana bird-of-paradise" },
    sb: { animal: "White-bellied sea eagle", animalHe: "עיט ים לבן-בטן", wiki: "White-bellied sea eagle" },
    ws: { animal: "Tooth-billed pigeon", animalHe: "יונת שיניים", wiki: "Tooth-billed pigeon" },
    to: { animal: "Pacific flying fox", animalHe: "שועל מעופף", wiki: "Pacific flying fox" },
    ki: { animal: "Great frigatebird", animalHe: "פריגטה גדולה", wiki: "Great frigatebird" },
    tv: { animal: "Great frigatebird", animalHe: "פריגטה גדולה", wiki: "Great frigatebird" },
    nr: { animal: "Great frigatebird", animalHe: "פריגטה גדולה", wiki: "Great frigatebird" },
    mh: { animal: "Great frigatebird", animalHe: "פריגטה גדולה", wiki: "Great frigatebird" },
    fm: { animal: "Guam kingfisher", animalHe: "שלדג גואם", wiki: "Guam kingfisher" },
    pw: { animal: "Dugong", animalHe: "תחש הנהרות", wiki: "Dugong" },
    gl: { animal: "Polar bear", animalHe: "דוב קוטב", wiki: "Polar bear" },
    fo: { animal: "Eurasian oystercatcher", animalHe: "שלדגית ים", wiki: "Eurasian oystercatcher" },
    hk: { animal: "Chinese white dolphin", animalHe: "דולפין סיני לבן", wiki: "Indo-Pacific humpback dolphin" },
    gi: { animal: "Barbary macaque", animalHe: "מקאק ברברי", wiki: "Barbary macaque" },
    bm: { animal: "Bermuda petrel", animalHe: "יסעור ברמודה", wiki: "Bermuda petrel" },
    ax: { animal: "White-tailed eagle", animalHe: "עיטם לבן-זנב", wiki: "White-tailed eagle" },
  };

  const THEMES = [
    { id: "flags", icon: "🏳️", nameKey: "theme.flags", blurbKey: "theme.flags.blurb" },
    { id: "animals", icon: "🦘", nameKey: "theme.animals", blurbKey: "theme.animals.blurb", nameGamesOnly: true },
  ];

  let memoryCache = new Map();
  let diskCache = null;

  function loadDiskCache() {
    if (diskCache) return diskCache;
    try {
      const raw = JSON.parse(localStorage.getItem(IMG_CACHE_KEY) || "{}");
      diskCache = raw && typeof raw === "object" ? raw : {};
    } catch {
      diskCache = {};
    }
    return diskCache;
  }

  function saveDiskCache() {
    try {
      localStorage.setItem(IMG_CACHE_KEY, JSON.stringify(loadDiskCache()));
    } catch {
    }
  }

  function bakedThumb(wikiTitle) {
    const key = String(wikiTitle || "").trim();
    return BAKED[key] || "";
  }

  function cachedThumb(wikiTitle) {
    const key = String(wikiTitle || "").trim();
    if (!key) return "";
    if (memoryCache.has(key)) return memoryCache.get(key);
    const baked = bakedThumb(key);
    if (baked) {
      memoryCache.set(key, baked);
      return baked;
    }
    const disk = loadDiskCache()[key];
    if (disk) {
      memoryCache.set(key, disk);
      return disk;
    }
    return "";
  }

  function getAnimal(code) {
    const row = ANIMALS[String(code || "").toLowerCase()];
    if (!row || !row.wiki) return null;
    return {
      animal: row.animal,
      animalHe: row.animalHe,
      animalWiki: row.wiki,
      animalImage: cachedThumb(row.wiki),
    };
  }

  function enrichCountry(country) {
    if (!country?.code) return country;
    const a = getAnimal(country.code);
    if (!a) return { ...country };
    return { ...country, ...a };
  }

  function filterAnimalPool(pool) {
    return (pool || []).map(enrichCountry).filter((c) => c.animalWiki);
  }

  function hasAnimal(code) {
    return Boolean(ANIMALS[String(code || "").toLowerCase()]?.wiki);
  }

  async function resolveWikiThumb(wikiTitle) {
    const key = String(wikiTitle || "").trim();
    if (!key) return "";
    const hit = cachedThumb(key);
    if (hit) return hit;

    try {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(key)}`;
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "Api-User-Agent": "MySpaceFlagQuiz/1.0 (desktop education quiz)",
        },
      });
      if (res.status === 429) return "";
      if (!res.ok) throw new Error(`wiki ${res.status}`);
      const data = await res.json();
      const finalUrl = data?.thumbnail?.source || data?.originalimage?.source || "";
      if (finalUrl) {
        memoryCache.set(key, finalUrl);
        const disk = loadDiskCache();
        disk[key] = finalUrl;
        saveDiskCache();
      }
      return finalUrl;
    } catch {
      return "";
    }
  }

  async function resolveCountryImage(country) {
    const wiki = country?.animalWiki || getAnimal(country?.code)?.animalWiki;
    if (!wiki) return "";
    const url = await resolveWikiThumb(wiki);
    if (country) country.animalImage = url || country.animalImage || "";
    return url;
  }
  function warmBrowserImages(urls, concurrency = 4) {
    const list = [...new Set((urls || []).filter(Boolean))];
    if (!list.length) return Promise.resolve();
    let i = 0;
    async function worker() {
      while (i < list.length) {
        const src = list[i++];
        await new Promise((resolve) => {
          const img = new Image();
          img.decoding = "async";
          const done = () => resolve();
          img.onload = done;
          img.onerror = done;
          img.src = src;
        });
        await new Promise((r) => setTimeout(r, 40));
      }
    }
    const n = Math.min(concurrency, list.length);
    return Promise.all(Array.from({ length: n }, () => worker()));
  }

  async function prefetchImages(countries, concurrency = 4) {
    const list = (countries || []).map(enrichCountry).filter((c) => c?.animalWiki);
    const pending = [];
    const seen = new Set();
    for (const c of list) {
      if (c.animalImage) continue;
      if (seen.has(c.animalWiki)) continue;
      seen.add(c.animalWiki);
      pending.push(c.animalWiki);
    }

    let i = 0;
    async function worker() {
      while (i < pending.length) {
        const wiki = pending[i++];
        await resolveWikiThumb(wiki);
      }
    }
    if (pending.length) {
      const n = Math.min(concurrency, pending.length);
      await Promise.all(Array.from({ length: n }, () => worker()));
    }

    for (const c of list) {
      c.animalImage = cachedThumb(c.animalWiki) || c.animalImage || "";
    }
    return list;
  }

  function loadTheme() {
    try {
      const id = localStorage.getItem(THEME_KEY) || "flags";
      return THEMES.some((t) => t.id === id) ? id : "flags";
    } catch {
      return "flags";
    }
  }

  function saveTheme(id) {
    try {
      localStorage.setItem(THEME_KEY, id);
    } catch {
    }
  }

  function getTheme(id) {
    return THEMES.find((t) => t.id === id) || THEMES[0];
  }

  function animalLabel(country, lang) {
    if (!country) return "";
    if (lang === "he" && country.animalHe) return country.animalHe;
    return country.animal || "";
  }

  root.FlagQuizThemes = {
    THEME_KEY,
    THEMES,
    ANIMALS,
    getAnimal,
    enrichCountry,
    filterAnimalPool,
    hasAnimal,
    resolveWikiThumb,
    resolveCountryImage,
    prefetchImages,
    warmBrowserImages,
    loadTheme,
    saveTheme,
    getTheme,
    animalLabel,
    animalCount: Object.keys(ANIMALS).length,
  };
})(typeof window !== "undefined" ? window : globalThis);
