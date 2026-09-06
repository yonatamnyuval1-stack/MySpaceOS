const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.join(__dirname, "..");
const dataDir = path.join(root, "data");

function readJson(name) {
  const file = path.join(dataDir, name);
  if (!fs.existsSync(file)) throw new Error(`Missing ${name}`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const stars = readJson("space-stars.json");
const earth = readJson("space-earth.json");
const ocean = readJson("space-ocean.json");

if (!Array.isArray(stars.stars) || stars.stars.length < 1000) {
  throw new Error(`Expected 1000+ stars, got ${stars.stars?.length || 0}`);
}
const sample = stars.stars[0];
for (const key of ["id", "x", "y", "z", "magnitude"]) {
  if (sample[key] == null) throw new Error(`Star missing field: ${key}`);
}

if (!Array.isArray(earth.countries) || earth.countries.length < 10) {
  throw new Error(`Expected countries in earth data, got ${earth.countries?.length || 0}`);
}

if (!Array.isArray(ocean.creatures) || ocean.creatures.length < 10) {
  throw new Error(`Expected ocean creatures, got ${ocean.creatures?.length || 0}`);
}

const jsFiles = [
  "apps/space/lib/starfield.js",
  "apps/space/lib/earthfield.js",
  "apps/space/lib/oceanfield.js",
  "apps/space/pages/navigate.js",
];
for (const rel of jsFiles) {
  execSync(`node --check "${path.join(root, rel)}"`, { stdio: "pipe" });
}

console.log("OK space data:", {
  stars: stars.stars.length,
  countries: earth.countries.length,
  creatures: ocean.creatures.length,
});
