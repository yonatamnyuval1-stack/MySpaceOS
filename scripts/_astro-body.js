const G = 6.6743e-11;
const c = 299792458;
const AU = 1.495978707e11;
const ly_m = 9.4607e15;
const M_sun = 1.98847e30;
const R_sun = 6.957e8;
const M_earth = 5.9722e24;
const R_earth = 6.371e6;
const g0 = 9.80665;

const BODIES = {
  sun: { name: "Sun", M: M_sun, R: R_sun },
  earth: { name: "Earth", M: M_earth, R: R_earth },
  moon: { name: "Moon", M: 7.342e22, R: 1.737e6 },
  mars: { name: "Mars", M: 6.4171e23, R: 3.39e6 },
  jupiter: { name: "Jupiter", M: 1.8982e27, R: 6.9911e7 },
};

function fmt(n, digits = 4) {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1e6 || (Math.abs(n) < 0.001 && n !== 0)) return n.toExponential(digits);
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function orbitalVelocity(massKg, radiusM) {
  return Math.sqrt((G * massKg) / radiusM);
}

function escapeVelocity(massKg, radiusM) {
  return Math.sqrt((2 * G * massKg) / radiusM);
}

function rocketDeltaV(ispS, m0, mf) {
  if (mf <= 0 || m0 <= mf) return NaN;
  return ispS * g0 * Math.log(m0 / mf);
}

function lightTime(distanceM) {
  return distanceM / c;
}

function schwarzschildRadius(massKg) {
  return (2 * G * massKg) / (c * c);
}

function keplerPeriodYears(semiMajorAxisAU, centralMassKg = M_sun) {
  const a = semiMajorAxisAU * AU;
  const T = 2 * Math.PI * Math.sqrt((a * a * a) / (G * centralMassKg));
  return T / (365.25 * 24 * 3600);
}

function hohmannDeltaV(r1, r2, massKg) {
  const v1 = orbitalVelocity(massKg, r1);
  const v2 = orbitalVelocity(massKg, r2);
  const dv1 = v1 * (Math.sqrt((2 * r2) / (r1 + r2)) - 1);
  const dv2 = v2 * (1 - Math.sqrt((2 * r1) / (r1 + r2)));
  return { dv1, dv2, total: dv1 + dv2 };
}

function parseDist(input, unit) {
  const v = Number(input);
  if (!Number.isFinite(v) || v < 0) return NaN;
  if (unit === "au") return v * AU;
  if (unit === "ly") return v * ly_m;
  if (unit === "km") return v * 1000;
  return v;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${fmt(seconds, 2)} s`;
  if (seconds < 3600) return `${fmt(seconds / 60, 2)} min`;
  if (seconds < 86400) return `${fmt(seconds / 3600, 2)} h`;
  return `${fmt(seconds / 86400, 2)} days`;
}

const api = {
  G,
  c,
  AU,
  ly_m,
  M_sun,
  M_earth,
  R_earth,
  g0,
  BODIES,
  fmt,
  orbitalVelocity,
  escapeVelocity,
  rocketDeltaV,
  lightTime,
  schwarzschildRadius,
  keplerPeriodYears,
  hohmannDeltaV,
  parseDist,
  formatDuration,
};

if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") {
  window.PartsAstroPhysics = api;
  window.SpacePhysics = api;
}