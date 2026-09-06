console.error(
  "[blocked] wire-themes-apps.js is unsafe (require/attach before myApp expose).\n" +
    "Use: node scripts/rewire-themes-safe.js"
);
process.exit(1);
