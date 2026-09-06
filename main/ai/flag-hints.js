const REGION_HE = {
  europe: "אירופה",
  "north-america": "צפון אמריקה",
  "south-america": "דרום אמריקה",
  africa: "אפריקה",
  asia: "אסיה",
  oceania: "אוקיאניה",
  caribbean: "הקריביים",
  "middle-east": "המזרח התיכון",
};

const CODE_REGION = {
  al: "europe", ad: "europe", at: "europe", by: "europe", be: "europe", ba: "europe",
  bg: "europe", hr: "europe", cz: "europe", dk: "europe", ee: "europe", fi: "europe",
  fr: "europe", de: "europe", gr: "europe", hu: "europe", is: "europe", ie: "europe",
  it: "europe", lv: "europe", li: "europe", lt: "europe", lu: "europe", mt: "europe",
  md: "europe", mc: "europe", me: "europe", nl: "europe", mk: "europe", no: "europe",
  pl: "europe", pt: "europe", ro: "europe", ru: "europe", sm: "europe", rs: "europe",
  sk: "europe", si: "europe", es: "europe", se: "europe", ch: "europe", ua: "europe",
  gb: "europe", va: "europe", xk: "europe",

  ca: "north-america", us: "north-america", mx: "north-america",

  ar: "south-america", bo: "south-america", br: "south-america", cl: "south-america",
  co: "south-america", ec: "south-america", gy: "south-america", py: "south-america",
  pe: "south-america", sr: "south-america", uy: "south-america", ve: "south-america",

  dz: "africa", ao: "africa", bj: "africa", bw: "africa", bf: "africa", bi: "africa",
  cv: "africa", cm: "africa", cf: "africa", td: "africa", km: "africa", cg: "africa",
  cd: "africa", ci: "africa", dj: "africa", eg: "africa", gq: "africa", er: "africa",
  sz: "africa", et: "africa", ga: "africa", gm: "africa", gh: "africa", gn: "africa",
  gw: "africa", ke: "africa", ls: "africa", lr: "africa", ly: "africa", mg: "africa",
  mw: "africa", ml: "africa", mr: "africa", mu: "africa", ma: "africa", mz: "africa",
  na: "africa", ne: "africa", ng: "africa", rw: "africa", st: "africa", sn: "africa",
  sc: "africa", sl: "africa", so: "africa", za: "africa", ss: "africa", sd: "africa",
  tz: "africa", tg: "africa", tn: "africa", ug: "africa", zm: "africa", zw: "africa",

  af: "asia", am: "asia", az: "asia", bd: "asia", bt: "asia", bn: "asia", kh: "asia",
  cn: "asia", ge: "asia", in: "asia", id: "asia", jp: "asia", kz: "asia", kp: "asia",
  kr: "asia", kg: "asia", la: "asia", my: "asia", mv: "asia", mn: "asia", mm: "asia",
  np: "asia", pk: "asia", ph: "asia", sg: "asia", lk: "asia", tw: "asia", tj: "asia",
  th: "asia", tl: "asia", tm: "asia", uz: "asia", vn: "asia",

  bh: "middle-east", cy: "middle-east", ir: "middle-east", iq: "middle-east",
  il: "middle-east", jo: "middle-east", kw: "middle-east", lb: "middle-east",
  om: "middle-east", ps: "middle-east", qa: "middle-east", sa: "middle-east",
  sy: "middle-east", tr: "middle-east", ae: "middle-east", ye: "middle-east",

  au: "oceania", fj: "oceania", ki: "oceania", mh: "oceania", fm: "oceania",
  nr: "oceania", nz: "oceania", pw: "oceania", pg: "oceania", ws: "oceania",
  sb: "oceania", to: "oceania", tv: "oceania", vu: "oceania",

  ag: "caribbean", bs: "caribbean", bb: "caribbean", bz: "caribbean", cu: "caribbean",
  dm: "caribbean", do: "caribbean", gd: "caribbean", ht: "caribbean", jm: "caribbean",
  kn: "caribbean", lc: "caribbean", vc: "caribbean", tt: "caribbean",
  cr: "north-america", sv: "north-america", gt: "north-america", hn: "north-america",
  ni: "north-america", pa: "north-america",
};

const VISUAL_HE = {
  ca: "במרכז יש עלה אדום מוכר מאוד.",
  ch: "צלב לבן במרכז על רקע אדום מלא.",
  jp: "עיגול אדום במרכז על רקע לבן.",
  us: "פסים וכוכבים בפינה.",
  gb: "צלבים חוצים (יוניון ג'ק).",
  fr: "שלושה פסים אנכיים כחול-לבן-אדום.",
  it: "שלושה פסים אנכיים ירוק-לבן-אדום.",
  de: "שלושה פסים אופקיים שחור-אדום-זהב.",
  br: "ירוק עם מעוין צהוב וכדור כחול במרכז.",
  in: "גלגל במרכז בין כתום ללבן לירוק.",
  cn: "כוכבים צהובים על רקע אדום.",
  kr: "עיגול אדום-כחול (טאיג'י) במרכז.",
  il: "מגן דוד כחול בין שני פסים כחולים.",
  tr: "סהר וכוכב לבנים על אדום.",
  se: "צלב צהוב על רקע כחול.",
  no: "צלב אדום עם שוליים כחולים על אדום.",
  dk: "צלב לבן על אדום.",
  fi: "צלב כחול על לבן.",
  gr: "צלב לבן ופסים כחול-לבן.",
  es: "פסים אדום-צהוב-אדום עם סמל בצד.",
  pt: "ירוק ואדום עם כדור/מגן במרכז.",
  mx: "נשר על קקטוס במרכז בין ירוק ללבן לאדום.",
  ar: "שמש עם פנים במרכז על פסים בהירים.",
  au: "כוכבים דרומיים + יוניון ג'ק בפינה.",
  nz: "כוכבים אדומים + יוניון ג'ק בפינה.",
  za: "צורת Y צבעונית אופקית.",
  ua: "שני פסים אופקיים כחול מעל צהוב.",
  pl: "שני פסים אופקיים לבן מעל אדום.",
  ie: "שלושה פסים אנכיים ירוק-לבן-כתום.",
  be: "שלושה פסים אנכיים שחור-צהוב-אדום.",
  nl: "שלושה פסים אופקיים אדום-לבן-כחול.",
  ru: "שלושה פסים אופקיים לבן-כחול-אדום.",
  sa: "כתב ערבי וחרב על רקע ירוק.",
  ae: "פס אנכי אדום + פסים אופקיים ירוק-לבן-שחור.",
  qa: "שיניים לבנות מול חום/סגול.",
  eg: "נשר במרכז בין אדום ללבן לשחור.",
  ma: "כוכב ירוק על אדום.",
  ng: "שלושה פסים אנכיים ירוק-לבן-ירוק.",
  ke: "חניתות ומגן במרכז.",
  th: "חמישה פסים אופקיים אדום-לבן-כחול-לבן-אדום.",
  vn: "כוכב צהוב גדול על אדום.",
  ph: "שמש וכוכבים + משולש כחול/אדום.",
  sg: "סהר וכוכבים על אדום מעל לבן.",
  my: "סהר וכוכב + פסים.",
  id: "שני פסים אופקיים אדום מעל לבן.",
  pk: "סהר וכוכב על ירוק עם פס לבן.",
  bd: "עיגול אדום על ירוק.",
  np: "שני משולשים אדומים עם שוליים כחולים (לא מלבן).",
  cl: "כוכב לבן בריבוע כחול + פס אדום תחתון.",
  pe: "שלושה פסים אנכיים אדום-לבן-אדום.",
  co: "צהוב רחב מעל כחול ואדום.",
  ve: "קשת כוכבים על פסים צהוב-כחול-אדום.",
  cu: "משולש אדום עם כוכב + פסים כחול-לבן.",
  jm: "צלב צהוב / משולשים שחור וירוק.",
  cr: "חמישה פסים עם כחול באמצע.",
};

function formatFlagHint(flag) {
  if (!flag || typeof flag !== "object") return null;
  const code = String(flag.flagCode || "").toLowerCase();
  const en = String(flag.flagCountry || "").trim();
  const bullets = [];

  const regionKey = CODE_REGION[code];
  if (regionKey && REGION_HE[regionKey]) {
    bullets.push(`המדינה נמצאת ב${REGION_HE[regionKey]}.`);
  }

  if (en) {
    const letter = en.charAt(0).toUpperCase();
    if (/[A-Z]/.test(letter)) {
      bullets.push(`באנגלית שם המדינה מתחיל באות **${letter}**.`);
    }
  }

  if (VISUAL_HE[code]) {
    bullets.push(VISUAL_HE[code]);
  } else {
    bullets.push("תסתכל על הצבעים העיקריים ועל הסמל (אם יש) במרכז או בפינה — זה בדרך כלל מספיק.");
  }

  return (
    "רמז בלי לחשוף את התשובה:\n" +
    bullets.map((b) => `• ${b}`).join("\n") +
    "\n\nאם תרצה את השם המלא — תגיד במפורש «מה התשובה»."
  );
}

function getVisualHint(code) {
  return VISUAL_HE[String(code || "").toLowerCase()] || null;
}

function formatFlagDescribe(flag) {
  if (!flag || typeof flag !== "object") return null;
  const code = String(flag.flagCode || "").toLowerCase();
  const en = flag.flagCountry || null;
  const he = flag.flagCountryHe || null;
  const look = getVisualHint(code);
  const nameBit = he && en ? `${he} (${en})` : en || he || null;
  const lines = [];
  if (look) lines.push(`איך זה נראה: ${look}`);
  else lines.push("איך זה נראה: דגל עם צבעים וסמל ייחודיים — שים לב למרכז ולרקע.");
  if (nameBit) lines.push(`זיהוי מהמסך: **${nameBit}**.`);
  return lines.join("\n");
}

module.exports = { formatFlagHint, formatFlagDescribe, getVisualHint };