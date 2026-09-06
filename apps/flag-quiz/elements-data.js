(function (root) {
  const RAW = [
    ["H", 1, "Hydrogen", "מימן", 1, 1, "nonmetal"],
    ["He", 2, "Helium", "הליום", 18, 1, "noble"],
    ["Li", 3, "Lithium", "ליתיום", 1, 2, "alkali"],
    ["Be", 4, "Beryllium", "בריליום", 2, 2, "alkaline"],
    ["B", 5, "Boron", "בור", 13, 2, "metalloid"],
    ["C", 6, "Carbon", "פחמן", 14, 2, "nonmetal"],
    ["N", 7, "Nitrogen", "חנקן", 15, 2, "nonmetal"],
    ["O", 8, "Oxygen", "חמצן", 16, 2, "nonmetal"],
    ["F", 9, "Fluorine", "פלואור", 17, 2, "halogen"],
    ["Ne", 10, "Neon", "ניאון", 18, 2, "noble"],
    ["Na", 11, "Sodium", "נתרן", 1, 3, "alkali"],
    ["Mg", 12, "Magnesium", "מגנזיום", 2, 3, "alkaline"],
    ["Al", 13, "Aluminum", "אלומיניום", 13, 3, "metal"],
    ["Si", 14, "Silicon", "צורן", 14, 3, "metalloid"],
    ["P", 15, "Phosphorus", "זרחן", 15, 3, "nonmetal"],
    ["S", 16, "Sulfur", "גופרית", 16, 3, "nonmetal"],
    ["Cl", 17, "Chlorine", "כלור", 17, 3, "halogen"],
    ["Ar", 18, "Argon", "ארגון", 18, 3, "noble"],
    ["K", 19, "Potassium", "אשלגן", 1, 4, "alkali"],
    ["Ca", 20, "Calcium", "סידן", 2, 4, "alkaline"],
    ["Sc", 21, "Scandium", "סקנדיום", 3, 4, "transition"],
    ["Ti", 22, "Titanium", "טיטניום", 4, 4, "transition"],
    ["V", 23, "Vanadium", "ונדיום", 5, 4, "transition"],
    ["Cr", 24, "Chromium", "כרום", 6, 4, "transition"],
    ["Mn", 25, "Manganese", "מנגן", 7, 4, "transition"],
    ["Fe", 26, "Iron", "ברזל", 8, 4, "transition"],
    ["Co", 27, "Cobalt", "קובלט", 9, 4, "transition"],
    ["Ni", 28, "Nickel", "ניקל", 10, 4, "transition"],
    ["Cu", 29, "Copper", "נחושת", 11, 4, "transition"],
    ["Zn", 30, "Zinc", "אבץ", 12, 4, "transition"],
    ["Ga", 31, "Gallium", "גליום", 13, 4, "metal"],
    ["Ge", 32, "Germanium", "גרמניום", 14, 4, "metalloid"],
    ["As", 33, "Arsenic", "ארסן", 15, 4, "metalloid"],
    ["Se", 34, "Selenium", "סלניום", 16, 4, "nonmetal"],
    ["Br", 35, "Bromine", "ברום", 17, 4, "halogen"],
    ["Kr", 36, "Krypton", "קריפטון", 18, 4, "noble"],
    ["Rb", 37, "Rubidium", "רובידיום", 1, 5, "alkali"],
    ["Sr", 38, "Strontium", "סטרונציום", 2, 5, "alkaline"],
    ["Y", 39, "Yttrium", "איטריום", 3, 5, "transition"],
    ["Zr", 40, "Zirconium", "זירקוניום", 4, 5, "transition"],
    ["Nb", 41, "Niobium", "ניוביום", 5, 5, "transition"],
    ["Mo", 42, "Molybdenum", "מוליבדן", 6, 5, "transition"],
    ["Tc", 43, "Technetium", "טכנטיום", 7, 5, "transition"],
    ["Ru", 44, "Ruthenium", "רותניום", 8, 5, "transition"],
    ["Rh", 45, "Rhodium", "רודיום", 9, 5, "transition"],
    ["Pd", 46, "Palladium", "פלדיום", 10, 5, "transition"],
    ["Ag", 47, "Silver", "כסף", 11, 5, "transition"],
    ["Cd", 48, "Cadmium", "קדמיום", 12, 5, "transition"],
    ["In", 49, "Indium", "אינדיום", 13, 5, "metal"],
    ["Sn", 50, "Tin", "בדיל", 14, 5, "metal"],
    ["Sb", 51, "Antimony", "אנטימון", 15, 5, "metalloid"],
    ["Te", 52, "Tellurium", "טלור", 16, 5, "metalloid"],
    ["I", 53, "Iodine", "יוד", 17, 5, "halogen"],
    ["Xe", 54, "Xenon", "קסנון", 18, 5, "noble"],
    ["Cs", 55, "Cesium", "צזיום", 1, 6, "alkali"],
    ["Ba", 56, "Barium", "בריום", 2, 6, "alkaline"],
    ["La", 57, "Lanthanum", "לנתן", 3, 6, "lanthanide"],
    ["Ce", 58, "Cerium", "צריום", 3, 6, "lanthanide"],
    ["Pr", 59, "Praseodymium", "פרזאודימיום", 3, 6, "lanthanide"],
    ["Nd", 60, "Neodymium", "ניאודימיום", 3, 6, "lanthanide"],
    ["Pm", 61, "Promethium", "פרומתיום", 3, 6, "lanthanide"],
    ["Sm", 62, "Samarium", "סמריום", 3, 6, "lanthanide"],
    ["Eu", 63, "Europium", "אירופיום", 3, 6, "lanthanide"],
    ["Gd", 64, "Gadolinium", "גדוליניום", 3, 6, "lanthanide"],
    ["Tb", 65, "Terbium", "טרביום", 3, 6, "lanthanide"],
    ["Dy", 66, "Dysprosium", "דיספרוסיום", 3, 6, "lanthanide"],
    ["Ho", 67, "Holmium", "הולמיום", 3, 6, "lanthanide"],
    ["Er", 68, "Erbium", "ארביום", 3, 6, "lanthanide"],
    ["Tm", 69, "Thulium", "תוליום", 3, 6, "lanthanide"],
    ["Yb", 70, "Ytterbium", "איטרביום", 3, 6, "lanthanide"],
    ["Lu", 71, "Lutetium", "לוטציום", 3, 6, "lanthanide"],
    ["Hf", 72, "Hafnium", "הפניום", 4, 6, "transition"],
    ["Ta", 73, "Tantalum", "טנטלום", 5, 6, "transition"],
    ["W", 74, "Tungsten", "טונגסטן", 6, 6, "transition"],
    ["Re", 75, "Rhenium", "רניום", 7, 6, "transition"],
    ["Os", 76, "Osmium", "אוסמיום", 8, 6, "transition"],
    ["Ir", 77, "Iridium", "אירידיום", 9, 6, "transition"],
    ["Pt", 78, "Platinum", "פלטינה", 10, 6, "transition"],
    ["Au", 79, "Gold", "זהב", 11, 6, "transition"],
    ["Hg", 80, "Mercury", "כספית", 12, 6, "transition"],
    ["Tl", 81, "Thallium", "תליום", 13, 6, "metal"],
    ["Pb", 82, "Lead", "עופרת", 14, 6, "metal"],
    ["Bi", 83, "Bismuth", "ביסמות", 15, 6, "metal"],
    ["Po", 84, "Polonium", "פולוניום", 16, 6, "metalloid"],
    ["At", 85, "Astatine", "אסטטין", 17, 6, "halogen"],
    ["Rn", 86, "Radon", "רדון", 18, 6, "noble"],
    ["Fr", 87, "Francium", "פרנציום", 1, 7, "alkali"],
    ["Ra", 88, "Radium", "רדיום", 2, 7, "alkaline"],
    ["Ac", 89, "Actinium", "אקטיניום", 3, 7, "actinide"],
    ["Th", 90, "Thorium", "תוריום", 3, 7, "actinide"],
    ["Pa", 91, "Protactinium", "פרוטקטיניום", 3, 7, "actinide"],
    ["U", 92, "Uranium", "אורניום", 3, 7, "actinide"],
    ["Np", 93, "Neptunium", "נפטוניום", 3, 7, "actinide"],
    ["Pu", 94, "Plutonium", "פלוטוניום", 3, 7, "actinide"],
    ["Am", 95, "Americium", "אמריציום", 3, 7, "actinide"],
    ["Cm", 96, "Curium", "קיריום", 3, 7, "actinide"],
    ["Bk", 97, "Berkelium", "ברקליום", 3, 7, "actinide"],
    ["Cf", 98, "Californium", "קליפורניום", 3, 7, "actinide"],
    ["Es", 99, "Einsteinium", "איינשטייניום", 3, 7, "actinide"],
    ["Fm", 100, "Fermium", "פרמיום", 3, 7, "actinide"],
    ["Md", 101, "Mendelevium", "מנדלביום", 3, 7, "actinide"],
    ["No", 102, "Nobelium", "נובליום", 3, 7, "actinide"],
    ["Lr", 103, "Lawrencium", "לורנציום", 3, 7, "actinide"],
    ["Rf", 104, "Rutherfordium", "רתרפורדיום", 4, 7, "transition"],
    ["Db", 105, "Dubnium", "דובניום", 5, 7, "transition"],
    ["Sg", 106, "Seaborgium", "סיבורגיום", 6, 7, "transition"],
    ["Bh", 107, "Bohrium", "בוהריום", 7, 7, "transition"],
    ["Hs", 108, "Hassium", "האסיום", 8, 7, "transition"],
    ["Mt", 109, "Meitnerium", "מייטנריום", 9, 7, "transition"],
    ["Ds", 110, "Darmstadtium", "דרמשטטיום", 10, 7, "transition"],
    ["Rg", 111, "Roentgenium", "רנטגניום", 11, 7, "transition"],
    ["Cn", 112, "Copernicium", "קופרניציום", 12, 7, "transition"],
    ["Nh", 113, "Nihonium", "ניהוניום", 13, 7, "metal"],
    ["Fl", 114, "Flerovium", "פלרוביום", 14, 7, "metal"],
    ["Mc", 115, "Moscovium", "מוסקוביום", 15, 7, "metal"],
    ["Lv", 116, "Livermorium", "ליברמוריום", 16, 7, "metal"],
    ["Ts", 117, "Tennessine", "טנסין", 17, 7, "halogen"],
    ["Og", 118, "Oganesson", "אוגנסון", 18, 7, "noble"],
  ];

  const EASY_ORDER = [
    "H", "He", "O", "C", "N", "Na", "Cl", "Fe", "Au", "Ag",
    "Cu", "Ca", "K", "Mg", "Al", "S", "P", "Si", "Ne", "Ar",
    "F", "Br", "I", "Zn", "Pb", "Hg", "Sn", "Ni", "Co", "Cr",
    "Mn", "Ti", "Li", "Be", "B", "Kr", "Xe", "Pt", "U", "W",
    "Ba", "Sr", "Cs", "Rb", "As", "Se", "Ge", "Ga", "Cd", "Sb",
  ];

  const ELEMENTS = RAW.map(([symbol, number, name, nameHe, group, period, category]) => ({
    code: symbol,
    symbol,
    number,
    name,
    nameHe,
    group,
    period,
    category,
  }));

  const byCode = new Map(ELEMENTS.map((e) => [e.code, e]));

  const easyRanked = [];
  const seen = new Set();
  for (const code of EASY_ORDER) {
    const el = byCode.get(code);
    if (el && !seen.has(code)) {
      easyRanked.push(el);
      seen.add(code);
    }
  }
  for (const el of ELEMENTS) {
    if (!seen.has(el.code)) {
      easyRanked.push(el);
      seen.add(el.code);
    }
  }

  const LEVEL_POOLS = { 1: 20, 2: 36, 3: 54, 4: 80 };

  function elementLabel(el, language) {
    if (!el) return "";
    return language === "he" && el.nameHe ? el.nameHe : el.name;
  }

  function poolForLevel(level) {
    if (Number(level) === 5) return ELEMENTS.slice();
    const n = LEVEL_POOLS[level];
    if (!n) return ELEMENTS.slice();
    return easyRanked.slice(0, Math.min(n, easyRanked.length));
  }

  function poolForHard50Level(level) {
    const nLevel = Number(level);
    const all = ELEMENTS;
    if (nLevel === 1 || nLevel === 0) return all.slice();
    if (nLevel === 2) {
      const exclude = new Set(easyRanked.slice(0, 20).map((e) => e.code));
      return all.filter((e) => !exclude.has(e.code));
    }
    if (nLevel === 3) {
      const exclude = new Set(easyRanked.slice(0, 36).map((e) => e.code));
      return all.filter((e) => !exclude.has(e.code));
    }
    if (nLevel === 4) return easyRanked.slice(-60);
    if (nLevel === 5) return easyRanked.slice(-40);
    return all.slice();
  }

  function similarPoolFor(correct, pool, count) {
    const n = Math.max(1, count || 3);
    const list = Array.isArray(pool) ? pool : ELEMENTS;
    const rest = list.filter((e) => e.code !== correct.code);
    const scored = rest.map((e) => {
      let score = 0;
      if (e.group === correct.group) score += 5;
      if (e.period === correct.period) score += 3;
      if (e.category === correct.category) score += 2;
      score += Math.max(0, 4 - Math.abs(e.number - correct.number));
      return { e, score };
    });
    scored.sort((a, b) => b.score - a.score || Math.random() - 0.5);
    const top = scored.slice(0, Math.min(n * 3, scored.length)).map((x) => x.e);
    for (let i = top.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [top[i], top[j]] = [top[j], top[i]];
    }
    const out = top.slice(0, n);
    while (out.length < n && rest.length) {
      const extra = rest.find((e) => !out.some((o) => o.code === e.code));
      if (!extra) break;
      out.push(extra);
    }
    return out;
  }

  root.ElementsQuizData = {
    elements: ELEMENTS,
    easyRanked,
    LEVEL_POOLS,
    poolForLevel,
    poolForHard50Level,
    elementLabel,
    similarPoolFor,
  };
})(window);
