(function (root) {
  const CLUSTERS = [
    ["ro", "td", "ad", "md"],
    ["be", "de", "ug"],
    ["fr", "nl", "ru", "sk", "si", "lu"],
    ["it", "hu", "bg", "ir", "mx"],
    ["ie", "ci"],
    ["ml", "gn", "sn", "cm", "bj"],
    ["be", "ye"],
    ["ru", "sk", "si", "nl", "lu", "hr", "rs"],
    ["am", "co", "ec", "ve", "bo", "lt"],
    ["at", "lv", "pe", "ca"],
    ["de", "be", "ee"],
    ["pl", "id", "mc", "sg", "mt"],
    ["ua", "se", "ar"],
    ["hu", "tj", "ir"],
    ["bg", "hu", "ir"],
    ["ee", "ng", "sl"],
    ["th", "cr"],
    ["ga", "cg", "rw"],
    ["ne", "in"],
    ["dk", "se", "no", "fi", "is", "fo", "ax", "gl"],
    ["gb", "au", "nz", "fj", "tv", "bm", "fk", "ky", "tc"],
    ["au", "nz"],
    ["bm", "fk", "ky", "tc", "vg", "ai", "ms", "sh"],
    ["gg", "je", "im"],
    ["ye", "eg", "sy", "iq", "sd", "ss"],
    ["ae", "jo", "kw", "ps", "sd"],
    ["om", "ae", "jo"],
    ["sa", "so"],
    ["bh", "qa"],
    ["tn", "tr"],
    ["dz", "tn", "tr", "pk"],
    ["ly", "ma"],
    ["eh", "ps"],
    ["ps", "jo", "sd"],
    ["hn", "sv", "ni", "gt", "ar", "uy"],
    ["cr", "th"],
    ["cu", "pr"],
    ["pr", "cu"],
    ["do", "pr"],
    ["aw", "cw", "sx"],
    ["vi", "pr"],
    ["mw", "bi", "ke"],
    ["rw", "cg", "ga"],
    ["td", "ro", "ad", "cg"],
    ["ne", "in", "ie"],
    ["gh", "et", "bo"],
    ["bj", "gn", "ml"],
    ["cm", "sn", "ml"],
    ["tg", "gn"],
    ["cf", "td"],
    ["gq", "mx"],
    ["er", "ss"],
    ["dj", "er"],
    ["na", "bw"],
    ["ls", "sz"],
    ["mz", "mw"],
    ["zm", "zw"],
    ["ao", "cd"],
    ["ci", "ie", "in"],
    ["cz", "ph", "cu"],
    ["sk", "si", "ru"],
    ["hr", "rs", "si", "sk"],
    ["ba", "hr"],
    ["al", "me"],
    ["mk", "bg"],
    ["gr", "uy"],
    ["cy", "xk"],
    ["ch", "to"],
    ["va", "ch"],
    ["li", "ht"],
    ["sm", "va"],
    ["mt", "pl"],
    ["is", "no"],
    ["pt", "es"],
    ["us", "my", "lr"],
    ["ca", "lb", "pe"],
    ["br", "pt"],
    ["cl", "pe"],
    ["py", "nl"],
    ["uy", "gr", "ar"],
    ["bo", "gh", "lt"],
    ["ec", "co", "ve"],
    ["ve", "co", "ec"],
    ["gy", "sr"],
    ["sr", "gy"],
    ["jm", "ag"],
    ["tt", "pa"],
    ["ht", "li"],
    ["bz", "gt"],
    ["pa", "us"],
    ["jp", "bd"],
    ["kr", "kp"],
    ["kp", "kr"],
    ["cn", "vn", "kp"],
    ["vn", "cn", "ma"],
    ["hk", "mo", "cn"],
    ["mo", "hk"],
    ["la", "kh"],
    ["kh", "la", "th"],
    ["th", "cr"],
    ["mm", "lt"],
    ["my", "us"],
    ["sg", "pl", "id"],
    ["id", "mc", "pl", "sg"],
    ["ph", "cz", "cu"],
    ["bn", "kz"],
    ["tl", "mz"],
    ["pg", "sb"],
    ["sb", "pg", "tv"],
    ["fj", "nz", "au", "tv"],
    ["tv", "fj", "nz"],
    ["to", "ch", "ge"],
    ["ws", "to"],
    ["nc", "pf", "fr"],
    ["pf", "nc"],
    ["as", "gu", "mp"],
    ["gu", "as", "mp"],
    ["ck", "nu", "nz"],
    ["nu", "ck"],
    ["gi", "gb"],
    ["cy", "xk"],
    ["xk", "al"],
    ["vu", "pg"],
    ["mn", "kz"],
    ["kz", "uz", "kg"],
    ["uz", "kz", "tm"],
    ["tm", "uz"],
    ["kg", "kz"],
    ["tj", "ir", "hu"],
    ["af", "tj"],
    ["pk", "tr", "tn"],
    ["bd", "jp", "pw"],
    ["lk", "mv"],
    ["mv", "lk", "tr"],
    ["np", "bt"],
    ["bt", "np"],
    ["in", "ne", "ie"],
    ["ir", "tj", "hu", "it"],
    ["iq", "sy", "ye", "eg"],
    ["sy", "iq", "ye", "eg"],
    ["lb", "at", "ca"],
    ["jo", "ps", "kw", "ae", "sd"],
    ["il", "ar"],
    ["za", "cf"],
    ["sc", "mu"],
    ["mu", "sc", "ie"],
    ["km", "km"],
    ["cv", "cu"],
    ["st", "pt"],
    ["gw", "gn"],
    ["gm", "sl"],
    ["sl", "ee", "ng"],
    ["lr", "us", "my"],
    ["mr", "sd"],
    ["eh", "ps"],
    ["ug", "be", "de"],
    ["ke", "mw", "ss"],
    ["tz", "zw"],
    ["bi", "mw"],
    ["rw", "cg"],
    ["so", "vn", "ma"],
    ["et", "gh", "bo"],
    ["ss", "ke", "sd"],
    ["sd", "ss", "eg", "ye"],
    ["mg", "id"],
    ["km", "km"],
  ];

  const FAMILIES = {
    nordic: ["dk", "se", "no", "fi", "is"],
    ukBlueEnsign: [
      "gb", "au", "nz", "fj", "tv", "bm", "fk", "ky", "tc", "vg", "ai", "ms", "sh", "ck", "nu", "pn",
    ],
    panArab: ["ye", "eg", "sy", "iq", "sd", "ps", "jo", "kw", "ae", "om", "ss", "eh"],
    panAfrican: ["gh", "et", "gn", "ml", "sn", "cm", "bj", "tg", "bf", "rw", "zw", "zm"],
    verticalTri: ["fr", "it", "be", "ie", "ci", "ro", "td", "ad", "md", "mx", "pe", "gn", "ml", "sn"],
    horizontalTri: ["ru", "nl", "de", "am", "at", "hu", "bg", "ee", "lt", "lv", "lu", "sk", "si", "ye", "eg"],
    redWhite: ["pl", "id", "mc", "sg", "at", "lv", "ca", "jp", "ch", "tr", "tn", "dk", "ge", "to"],
    centralAmerica: ["hn", "sv", "ni", "gt", "cr", "bz", "pa"],
    andean: ["co", "ec", "ve", "bo", "pe", "ar", "uy", "py", "cl"],
    eastAsia: ["cn", "vn", "kp", "kr", "jp", "mn", "la", "kh", "hk", "mo"],
    turkic: ["tr", "az", "tm", "uz", "kz", "kg", "pk", "tn", "mv"],
    scandinavianish: ["dk", "se", "no", "fi", "is", "ee", "fo", "ax", "gl"],
    caribbean: [
      "cu", "do", "ht", "jm", "tt", "bb", "bs", "ag", "gd", "kn", "lc", "vc", "dm",
      "pr", "vi", "aw", "cw", "sx", "gp", "mq", "bl", "tc", "ky", "ms", "ai", "vg", "bm",
    ],
    oceania: [
      "au", "nz", "fj", "pg", "sb", "vu", "to", "ws", "tv", "ki", "mh", "fm", "pw", "nr",
      "nc", "pf", "ck", "nu", "tk", "nf", "as", "gu", "mp", "wf", "cx", "cc",
    ],
    channelIsles: ["gg", "je", "im", "gb"],
    frenchOverseas: ["pf", "nc", "gf", "gp", "mq", "re", "yt", "pm", "bl", "wf"],
  };

  const TWINS = [
    ["ro", "td"],
    ["id", "mc"],
    ["ie", "ci"],
    ["au", "nz"],
    ["nl", "lu"],
    ["ru", "sk"],
    ["no", "is"],
    ["se", "fi"],
    ["co", "ec"],
    ["hn", "sv"],
    ["hn", "ni"],
    ["sv", "ni"],
    ["ml", "gn"],
    ["gn", "sn"],
    ["ye", "eg"],
    ["eg", "sy"],
    ["sy", "iq"],
    ["pl", "id"],
    ["pl", "mc"],
    ["at", "lv"],
    ["hu", "bg"],
    ["it", "mx"],
    ["be", "de"],
    ["ne", "in"],
    ["th", "cr"],
    ["mw", "bi"],
    ["bj", "gn"],
    ["fr", "nl"],
    ["sk", "si"],
    ["om", "ae"],
    ["qa", "bh"],
    ["kr", "kp"],
    ["us", "my"],
    ["us", "lr"],
    ["ca", "lb"],
    ["jp", "bd"],
    ["cn", "vn"],
    ["ar", "uy"],
    ["bo", "gh"],
    ["am", "lt"],
    ["cz", "ph"],
    ["pe", "at"],
    ["cl", "pe"],
    ["bm", "ky"],
    ["pr", "cu"],
    ["hk", "mo"],
    ["fo", "is"],
    ["dk", "ch"],
    ["to", "ch"],
    ["vu", "za"],
  ];

  function bump(scores, a, b, w) {
    if (!a || !b || a === b) return;
    if (!scores.has(a)) scores.set(a, new Map());
    if (!scores.has(b)) scores.set(b, new Map());
    scores.get(a).set(b, (scores.get(a).get(b) || 0) + w);
    scores.get(b).set(a, (scores.get(b).get(a) || 0) + w);
  }

  function buildSimilarMap(allCodes) {
    const codeSet = new Set(allCodes);
    const scores = new Map();

    for (const pair of TWINS) {
      if (codeSet.has(pair[0]) && codeSet.has(pair[1])) bump(scores, pair[0], pair[1], 6);
    }
    for (const g of CLUSTERS) {
      const members = g.filter((c) => codeSet.has(c));
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) bump(scores, members[i], members[j], 4);
      }
    }
    for (const members of Object.values(FAMILIES)) {
      const list = members.filter((c) => codeSet.has(c));
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) bump(scores, list[i], list[j], 1);
      }
    }

    const map = Object.create(null);
    const all = [...codeSet];

    for (const code of all) {
      const m = scores.get(code) || new Map();
      let ranked = [...m.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([c]) => c);

      if (ranked.length < 8) {
        const second = new Map();
        for (const near of ranked.slice(0, 4)) {
          const nearMap = scores.get(near);
          if (!nearMap) continue;
          for (const [c, w] of nearMap) {
            if (c === code || ranked.includes(c)) continue;
            second.set(c, (second.get(c) || 0) + w);
          }
        }
        const extra = [...second.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([c]) => c);
        ranked = ranked.concat(extra.filter((c) => !ranked.includes(c)));
      }

      if (ranked.length < 8) {
        const fillers = all.filter((c) => c !== code && !ranked.includes(c));
        ranked = ranked.concat(fillers);
      }

      map[code] = ranked.slice(0, 8);
    }

    return map;
  }

  let cachedMap = null;
  let cachedKey = "";

  function similarMapForPool(pool) {
    const codes = (pool || []).map((c) => c.code).filter(Boolean);
    const key = codes.slice().sort().join(",");
    if (cachedMap && cachedKey === key) return cachedMap;
    cachedKey = key;
    cachedMap = buildSimilarMap(codes);
    return cachedMap;
  }

  function similarPoolFor(correct, pool, count) {
    const need = Math.max(0, Number(count) || 0);
    if (!correct?.code || need === 0) return [];
    const all = root.FlagQuizData?.countries || pool || [];
    const allMap = byCodeMap(all);
    const fullMap = similarMapForPool(all);
    const neighborCodes = (fullMap[correct.code] || []).filter(
      (code) => code !== correct.code && allMap.has(code)
    );

    const shuffled = [...neighborCodes].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, need).map((code) => allMap.get(code));
  }

  function byCodeMap(pool) {
    const m = new Map();
    for (const c of pool || []) m.set(c.code, c);
    return m;
  }

  function topSimilarCodes(code, pool) {
    const similarMap = similarMapForPool(pool || root.FlagQuizData?.countries || []);
    return (similarMap[code] || []).slice();
  }

  root.FlagQuizSimilar = {
    buildSimilarMap,
    similarMapForPool,
    similarPoolFor,
    topSimilarCodes,
    CLUSTERS,
    FAMILIES,
    TWINS,
  };
})(typeof window !== "undefined" ? window : globalThis);