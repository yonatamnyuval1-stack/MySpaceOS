const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "data", "space-stars.json");
const TOTAL = 5600;

const CONSTELLATIONS = [
  "Orion", "Ursa Major", "Cassiopeia", "Cygnus", "Lyra", "Scorpius", "Sagittarius",
  "Leo", "Gemini", "Taurus", "Auriga", "Boötes", "Virgo", "Centaurus", "Crux",
  "Pegasus", "Andromeda", "Perseus", "Aquarius", "Pisces", "Aries", "Cancer",
  "Libra", "Capricornus", "Aquila", "Delphinus", "Draco", "Hercules", "Ophiuchus",
];

const SPECTRAL = ["O", "B", "A", "F", "G", "K", "M"];

const NAMED = [
  { name: "Sirius", distLy: 8.6, mag: -1.46, spectral: "A1V", constellation: "Canis Major", wikiTitle: "Sirius", color: "#e0f2fe" },
  { name: "Canopus", distLy: 310, mag: -0.74, spectral: "A9II", constellation: "Carina", wikiTitle: "Canopus", color: "#fef3c7" },
  { name: "Alpha Centauri", distLy: 4.37, mag: -0.27, spectral: "G2V", constellation: "Centaurus", wikiTitle: "Alpha Centauri", color: "#fef9c3" },
  { name: "Arcturus", distLy: 37, mag: -0.05, spectral: "K1.5III", constellation: "Boötes", wikiTitle: "Arcturus", color: "#fdba74" },
  { name: "Vega", distLy: 25, mag: 0.03, spectral: "A0V", constellation: "Lyra", wikiTitle: "Vega", color: "#dbeafe" },
  { name: "Capella", distLy: 43, mag: 0.08, spectral: "G8III", constellation: "Auriga", wikiTitle: "Capella", color: "#fde68a" },
  { name: "Rigel", distLy: 860, mag: 0.13, spectral: "B8Ia", constellation: "Orion", wikiTitle: "Rigel", color: "#bfdbfe" },
  { name: "Procyon", distLy: 11.4, mag: 0.34, spectral: "F5IV", constellation: "Canis Minor", wikiTitle: "Procyon", color: "#f1f5f9" },
  { name: "Betelgeuse", distLy: 550, mag: 0.42, spectral: "M1-2Ia", constellation: "Orion", wikiTitle: "Betelgeuse", color: "#ef4444" },
  { name: "Achernar", distLy: 139, mag: 0.46, spectral: "B6Vep", constellation: "Eridanus", wikiTitle: "Achernar", color: "#93c5fd" },
  { name: "Hadar", distLy: 390, mag: 0.61, spectral: "B1III", constellation: "Centaurus", wikiTitle: "Beta Centauri", color: "#7dd3fc" },
  { name: "Altair", distLy: 17, mag: 0.76, spectral: "A7V", constellation: "Aquila", wikiTitle: "Altair", color: "#e2e8f0" },
  { name: "Aldebaran", distLy: 65, mag: 0.86, spectral: "K5III", constellation: "Taurus", wikiTitle: "Aldebaran", color: "#fb923c" },
  { name: "Antares", distLy: 550, mag: 0.96, spectral: "M1.5Iab", constellation: "Scorpius", wikiTitle: "Antares", color: "#dc2626" },
  { name: "Spica", distLy: 250, mag: 1.04, spectral: "B1III", constellation: "Virgo", wikiTitle: "Spica", color: "#a5b4fc" },
  { name: "Pollux", distLy: 34, mag: 1.14, spectral: "K0III", constellation: "Gemini", wikiTitle: "Pollux", color: "#fcd34d" },
  { name: "Fomalhaut", distLy: 25, mag: 1.16, spectral: "A3V", constellation: "Piscis Austrinus", wikiTitle: "Fomalhaut", color: "#f8fafc" },
  { name: "Deneb", distLy: 2600, mag: 1.25, spectral: "A2Ia", constellation: "Cygnus", wikiTitle: "Deneb", color: "#e0e7ff" },
  { name: "Regulus", distLy: 79, mag: 1.35, spectral: "B7V", constellation: "Leo", wikiTitle: "Regulus", color: "#bae6fd" },
  { name: "Castor", distLy: 51, mag: 1.57, spectral: "A1V", constellation: "Gemini", wikiTitle: "Castor (star)", color: "#f1f5f9" },
  { name: "Bellatrix", distLy: 250, mag: 1.64, spectral: "B2III", constellation: "Orion", wikiTitle: "Bellatrix", color: "#c7d2fe" },
  { name: "Elnath", distLy: 134, mag: 1.65, spectral: "B7III", constellation: "Taurus", wikiTitle: "Elnath", color: "#ddd6fe" },
  { name: "Alnilam", distLy: 2000, mag: 1.69, spectral: "B0Ia", constellation: "Orion", wikiTitle: "Alnilam", color: "#93c5fd" },
  { name: "Alnitak", distLy: 1260, mag: 1.74, spectral: "O9.5Ib", constellation: "Orion", wikiTitle: "Alnitak", color: "#60a5fa" },
  { name: "Dubhe", distLy: 123, mag: 1.79, spectral: "K0III", constellation: "Ursa Major", wikiTitle: "Dubhe", color: "#fdba74" },
  { name: "Alioth", distLy: 83, mag: 1.77, spectral: "A0p", constellation: "Ursa Major", wikiTitle: "Alioth", color: "#e2e8f0" },
  { name: "Polaris", distLy: 433, mag: 1.98, spectral: "F7Ib", constellation: "Ursa Minor", wikiTitle: "Polaris", color: "#fef9c3" },
  { name: "Mirfak", distLy: 510, mag: 1.79, spectral: "F5Ib", constellation: "Perseus", wikiTitle: "Mirfak", color: "#fef3c7" },
  { name: "Proxima Centauri", distLy: 4.24, mag: 11.05, spectral: "M5.5Ve", constellation: "Centaurus", wikiTitle: "Proxima Centauri", color: "#fca5a5" },
  { name: "Barnard's Star", distLy: 5.96, mag: 9.5, spectral: "M4.0Ve", constellation: "Ophiuchus", wikiTitle: "Barnard's Star", color: "#f87171" },
  { name: "Tau Ceti", distLy: 12, mag: 3.49, spectral: "G8.5V", constellation: "Cetus", wikiTitle: "Tau Ceti", color: "#fde68a" },
  { name: "Epsilon Eridani", distLy: 10.5, mag: 3.73, spectral: "K2V", constellation: "Eridanus", wikiTitle: "Epsilon Eridani", color: "#fcd34d" },
];

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sphericalPosition(distLy, rand) {
  const u = rand();
  const v = rand();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const r = distLy;
  return {
    x: r * Math.sin(phi) * Math.cos(theta),
    y: r * Math.sin(phi) * Math.sin(theta),
    z: r * Math.cos(phi),
  };
}

function main() {
  const rand = mulberry32(42);
  const stars = [];
  let id = 0;

  for (const n of NAMED) {
    const pos = sphericalPosition(n.distLy, rand);
    stars.push({
      id: `star_${id++}`,
      name: n.name,
      named: true,
      x: Math.round(pos.x * 10) / 10,
      y: Math.round(pos.y * 10) / 10,
      z: Math.round(pos.z * 10) / 10,
      distLy: n.distLy,
      magnitude: n.mag,
      spectral: n.spectral,
      constellation: n.constellation,
      wikiTitle: n.wikiTitle,
      color: n.color,
    });
  }

  while (stars.length < TOTAL) {
    const distLy = 4 + rand() ** 1.4 * 12000;
    const pos = sphericalPosition(distLy, rand);
    const mag = 2 + rand() * 8;
    const spectral = SPECTRAL[Math.floor(rand() * SPECTRAL.length)];
    const constellation = CONSTELLATIONS[Math.floor(rand() * CONSTELLATIONS.length)];
    const hip = 100000 + stars.length;
    stars.push({
      id: `star_${id++}`,
      name: `HIP ${hip}`,
      named: false,
      x: Math.round(pos.x * 10) / 10,
      y: Math.round(pos.y * 10) / 10,
      z: Math.round(pos.z * 10) / 10,
      distLy: Math.round(distLy * 10) / 10,
      magnitude: Math.round(mag * 100) / 100,
      spectral: `${spectral}${Math.floor(rand() * 9)}V`,
      constellation,
      wikiTitle: "",
      color: spectralColor(spectral),
    });
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ updatedAt: Date.now(), count: stars.length, stars }, null, 0), "utf8");
  console.log(`Wrote ${stars.length} stars to ${OUT}`);
}

function spectralColor(s) {
  const map = { O: "#9bbcff", B: "#aabfff", A: "#e8f0ff", F: "#f5f8ff", G: "#fff4e6", K: "#ffcc80", M: "#ff6b6b" };
  return map[s[0]] || "#ffffff";
}

main();
