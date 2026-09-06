const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "data", "space-ocean.json");
const TARGET = 480;
const WORLD_KM = 120;
const MIN_DIST_KM = 3.2;
const SECTOR_KM = 30;
const SECTORS_PER_AXIS = Math.floor((WORLD_KM * 2) / SECTOR_KM);
const MIN_PER_SECTOR = 6;

const REEF_CENTERS = [
  { x: 0, y: 0, r: 18 },
  { x: -18, y: -32, r: 14 },
  { x: 28, y: -12, r: 14 },
  { x: -55, y: 45, r: 15 },
  { x: 60, y: -50, r: 14 },
  { x: -70, y: -20, r: 16 },
  { x: 45, y: 70, r: 14 },
  { x: -40, y: 55, r: 15 },
  { x: 80, y: 15, r: 13 },
  { x: -85, y: 60, r: 12 },
  { x: 15, y: -75, r: 14 },
  { x: -25, y: 85, r: 13 },
  { x: 95, y: -35, r: 12 },
  { x: -95, y: -55, r: 12 },
  { x: 55, y: -85, r: 13 },
  { x: -60, y: -70, r: 14 },
];

const DEEP_CENTERS = [
  { x: 55, y: 48, r: 28 },
  { x: -55, y: -48, r: 28 },
  { x: 70, y: -60, r: 24 },
  { x: -75, y: 50, r: 26 },
  { x: 0, y: 80, r: 22 },
  { x: 90, y: 0, r: 24 },
  { x: -90, y: 10, r: 22 },
  { x: 30, y: -90, r: 20 },
];

const SPECIES = [
  { id: "copepod", name: "Copepod", rarity: "common", spawnWeight: 12, depthMin: 0, depthMax: 200, zone: "epipelagic", emoji: "🔹", color: "#7dd3fc", size: 0.4, wikiTitle: "Copepod" },
  { id: "krill", name: "Antarctic krill", rarity: "common", spawnWeight: 10, depthMin: 0, depthMax: 300, zone: "epipelagic", emoji: "🦐", color: "#f472b6", size: 0.5, wikiTitle: "Antarctic krill" },
  { id: "sardine", name: "Sardine", rarity: "common", spawnWeight: 14, depthMin: 0, depthMax: 200, zone: "epipelagic", emoji: "🐟", color: "#94a3b8", size: 0.55, wikiTitle: "Sardine" },
  { id: "anchovy", name: "Anchovy", rarity: "common", spawnWeight: 12, depthMin: 0, depthMax: 150, zone: "epipelagic", emoji: "🐟", color: "#a8a29e", size: 0.5, wikiTitle: "Anchovy" },
  { id: "herring", name: "Atlantic herring", rarity: "common", spawnWeight: 11, depthMin: 0, depthMax: 250, zone: "epipelagic", emoji: "🐟", color: "#cbd5e1", size: 0.6, wikiTitle: "Atlantic herring" },
  { id: "mackerel", name: "Atlantic mackerel", rarity: "common", spawnWeight: 10, depthMin: 0, depthMax: 300, zone: "epipelagic", emoji: "🐟", color: "#38bdf8", size: 0.65, wikiTitle: "Atlantic mackerel" },
  { id: "cod", name: "Atlantic cod", rarity: "common", spawnWeight: 9, depthMin: 10, depthMax: 400, zone: "epipelagic", emoji: "🐟", color: "#64748b", size: 0.7, wikiTitle: "Atlantic cod" },
  { id: "tuna", name: "Bluefin tuna", rarity: "uncommon", spawnWeight: 6, depthMin: 0, depthMax: 1000, zone: "epipelagic", emoji: "🐟", color: "#1e3a5f", size: 0.85, wikiTitle: "Atlantic bluefin tuna" },
  { id: "dolphin", name: "Common dolphin", rarity: "uncommon", spawnWeight: 5, depthMin: 0, depthMax: 200, zone: "epipelagic", emoji: "🐬", color: "#60a5fa", size: 0.9, wikiTitle: "Common dolphin" },
  { id: "bottlenose", name: "Bottlenose dolphin", rarity: "uncommon", spawnWeight: 5, depthMin: 0, depthMax: 300, zone: "epipelagic", emoji: "🐬", color: "#93c5fd", size: 0.95, wikiTitle: "Bottlenose dolphin" },
  { id: "sea_turtle", name: "Green sea turtle", rarity: "uncommon", spawnWeight: 4, depthMin: 0, depthMax: 150, zone: "epipelagic", emoji: "🐢", color: "#4ade80", size: 0.85, wikiTitle: "Green sea turtle" },
  { id: "clownfish", name: "Clownfish", rarity: "common", spawnWeight: 8, depthMin: 1, depthMax: 15, zone: "reef", emoji: "🐠", color: "#fb923c", size: 0.45, wikiTitle: "Clownfish" },
  { id: "parrotfish", name: "Parrotfish", rarity: "common", spawnWeight: 7, depthMin: 1, depthMax: 30, zone: "reef", emoji: "🐠", color: "#34d399", size: 0.6, wikiTitle: "Parrotfish" },
  { id: "angelfish", name: "Queen angelfish", rarity: "uncommon", spawnWeight: 4, depthMin: 2, depthMax: 40, zone: "reef", emoji: "🐠", color: "#fbbf24", size: 0.55, wikiTitle: "Queen angelfish" },
  { id: "butterflyfish", name: "Butterflyfish", rarity: "common", spawnWeight: 7, depthMin: 1, depthMax: 25, zone: "reef", emoji: "🐠", color: "#fde047", size: 0.5, wikiTitle: "Butterflyfish" },
  { id: "grouper", name: "Goliath grouper", rarity: "uncommon", spawnWeight: 3, depthMin: 5, depthMax: 80, zone: "reef", emoji: "🐟", color: "#78716c", size: 1.1, wikiTitle: "Goliath grouper" },
  { id: "moray", name: "Moray eel", rarity: "uncommon", spawnWeight: 4, depthMin: 5, depthMax: 100, zone: "reef", emoji: "🐍", color: "#a3e635", size: 0.75, wikiTitle: "Moray eel" },
  { id: "octopus", name: "Common octopus", rarity: "uncommon", spawnWeight: 4, depthMin: 10, depthMax: 200, zone: "reef", emoji: "🐙", color: "#c084fc", size: 0.7, wikiTitle: "Common octopus" },
  { id: "cuttlefish", name: "Cuttlefish", rarity: "uncommon", spawnWeight: 3, depthMin: 20, depthMax: 150, zone: "reef", emoji: "🦑", color: "#f9a8d4", size: 0.65, wikiTitle: "Cuttlefish" },
  { id: "seahorse", name: "Seahorse", rarity: "uncommon", spawnWeight: 3, depthMin: 1, depthMax: 30, zone: "reef", emoji: "🐴", color: "#fcd34d", size: 0.35, wikiTitle: "Seahorse" },
  { id: "lionfish", name: "Red lionfish", rarity: "uncommon", spawnWeight: 3, depthMin: 2, depthMax: 120, zone: "reef", emoji: "🐠", color: "#ef4444", size: 0.55, wikiTitle: "Pterois" },
  { id: "manta", name: "Giant oceanic manta ray", rarity: "rare", spawnWeight: 2, depthMin: 0, depthMax: 120, zone: "epipelagic", emoji: "🪽", color: "#1e293b", size: 1.4, wikiTitle: "Oceanic manta ray" },
  { id: "stingray", name: "Stingray", rarity: "common", spawnWeight: 5, depthMin: 5, depthMax: 80, zone: "reef", emoji: "🪽", color: "#57534e", size: 0.8, wikiTitle: "Stingray" },
  { id: "whale_shark", name: "Whale shark", rarity: "rare", spawnWeight: 1, depthMin: 0, depthMax: 200, zone: "epipelagic", emoji: "🦈", color: "#3b82f6", size: 1.6, wikiTitle: "Whale shark" },
  { id: "great_white", name: "Great white shark", rarity: "rare", spawnWeight: 2, depthMin: 0, depthMax: 1200, zone: "epipelagic", emoji: "🦈", color: "#94a3b8", size: 1.3, wikiTitle: "Great white shark" },
  { id: "hammerhead", name: "Hammerhead shark", rarity: "rare", spawnWeight: 2, depthMin: 0, depthMax: 300, zone: "epipelagic", emoji: "🦈", color: "#64748b", size: 1.2, wikiTitle: "Hammerhead shark" },
  { id: "blue_shark", name: "Blue shark", rarity: "uncommon", spawnWeight: 3, depthMin: 0, depthMax: 350, zone: "epipelagic", emoji: "🦈", color: "#2563eb", size: 1.0, wikiTitle: "Blue shark" },
  { id: "blue_whale", name: "Blue whale", rarity: "legendary", spawnWeight: 1, depthMin: 0, depthMax: 500, zone: "epipelagic", emoji: "🐋", color: "#1d4ed8", size: 2.2, wikiTitle: "Blue whale" },
  { id: "humpback", name: "Humpback whale", rarity: "rare", spawnWeight: 1, depthMin: 0, depthMax: 200, zone: "epipelagic", emoji: "🐋", color: "#3b82f6", size: 1.8, wikiTitle: "Humpback whale" },
  { id: "orca", name: "Orca", rarity: "rare", spawnWeight: 1, depthMin: 0, depthMax: 500, zone: "epipelagic", emoji: "🐋", color: "#0f172a", size: 1.5, wikiTitle: "Orca" },
  { id: "sperm_whale", name: "Sperm whale", rarity: "rare", spawnWeight: 1, depthMin: 200, depthMax: 3000, zone: "mesopelagic", emoji: "🐋", color: "#475569", size: 1.7, wikiTitle: "Sperm whale" },
  { id: "jellyfish", name: "Moon jellyfish", rarity: "common", spawnWeight: 8, depthMin: 0, depthMax: 50, zone: "epipelagic", emoji: "🪼", color: "#e9d5ff", size: 0.5, wikiTitle: "Aurelia aurita" },
  { id: "box_jelly", name: "Box jellyfish", rarity: "uncommon", spawnWeight: 2, depthMin: 0, depthMax: 40, zone: "reef", emoji: "🪼", color: "#f0abfc", size: 0.45, wikiTitle: "Box jellyfish" },
  { id: "man_o_war", name: "Portuguese man o' war", rarity: "uncommon", spawnWeight: 2, depthMin: 0, depthMax: 20, zone: "epipelagic", emoji: "🪼", color: "#a78bfa", size: 0.6, wikiTitle: "Portuguese man o' war" },
  { id: "squid", name: "Humboldt squid", rarity: "uncommon", spawnWeight: 3, depthMin: 100, depthMax: 700, zone: "mesopelagic", emoji: "🦑", color: "#fca5a5", size: 0.9, wikiTitle: "Humboldt squid" },
  { id: "giant_squid", name: "Giant squid", rarity: "legendary", spawnWeight: 1, depthMin: 300, depthMax: 1500, zone: "bathypelagic", emoji: "🦑", color: "#dc2626", size: 1.8, wikiTitle: "Giant squid" },
  { id: "nautilus", name: "Chambered nautilus", rarity: "rare", spawnWeight: 1, depthMin: 100, depthMax: 500, zone: "mesopelagic", emoji: "🐚", color: "#f97316", size: 0.5, wikiTitle: "Chambered nautilus" },
  { id: "crab", name: "Blue crab", rarity: "common", spawnWeight: 6, depthMin: 0, depthMax: 40, zone: "reef", emoji: "🦀", color: "#2563eb", size: 0.45, wikiTitle: "Callinectes sapidus" },
  { id: "lobster", name: "American lobster", rarity: "uncommon", spawnWeight: 3, depthMin: 5, depthMax: 150, zone: "reef", emoji: "🦞", color: "#b91c1c", size: 0.55, wikiTitle: "American lobster" },
  { id: "shrimp", name: "Mantis shrimp", rarity: "uncommon", spawnWeight: 3, depthMin: 5, depthMax: 80, zone: "reef", emoji: "🦐", color: "#22c55e", size: 0.4, wikiTitle: "Mantis shrimp" },
  { id: "starfish", name: "Sea star", rarity: "common", spawnWeight: 6, depthMin: 0, depthMax: 60, zone: "reef", emoji: "⭐", color: "#f97316", size: 0.4, wikiTitle: "Starfish" },
  { id: "sea_urchin", name: "Sea urchin", rarity: "common", spawnWeight: 6, depthMin: 0, depthMax: 50, zone: "reef", emoji: "🦔", color: "#a855f7", size: 0.35, wikiTitle: "Sea urchin" },
  { id: "coral", name: "Brain coral colony", rarity: "common", spawnWeight: 9, depthMin: 1, depthMax: 25, zone: "reef", emoji: "🪸", color: "#fb7185", size: 0.7, wikiTitle: "Brain coral" },
  { id: "anemone", name: "Sea anemone", rarity: "common", spawnWeight: 8, depthMin: 1, depthMax: 20, zone: "reef", emoji: "🌸", color: "#ec4899", size: 0.5, wikiTitle: "Sea anemone" },
  { id: "lanternfish", name: "Lanternfish", rarity: "common", spawnWeight: 10, depthMin: 200, depthMax: 1000, zone: "mesopelagic", emoji: "✨", color: "#fef08a", size: 0.35, wikiTitle: "Lanternfish" },
  { id: "hatchetfish", name: "Hatchetfish", rarity: "common", spawnWeight: 8, depthMin: 200, depthMax: 1500, zone: "mesopelagic", emoji: "🐟", color: "#a5b4fc", size: 0.4, wikiTitle: "Marine hatchetfish" },
  { id: "viperfish", name: "Viperfish", rarity: "uncommon", spawnWeight: 3, depthMin: 500, depthMax: 2500, zone: "bathypelagic", emoji: "🐟", color: "#6366f1", size: 0.5, wikiTitle: "Viperfish" },
  { id: "dragonfish", name: "Black dragonfish", rarity: "uncommon", spawnWeight: 3, depthMin: 500, depthMax: 2000, zone: "bathypelagic", emoji: "🐉", color: "#312e81", size: 0.45, wikiTitle: "Black dragonfish" },
  { id: "anglerfish", name: "Anglerfish", rarity: "rare", spawnWeight: 2, depthMin: 1000, depthMax: 4000, zone: "bathypelagic", emoji: "💡", color: "#fcd34d", size: 0.55, wikiTitle: "Anglerfish" },
  { id: "gulper_eel", name: "Gulper eel", rarity: "rare", spawnWeight: 1, depthMin: 500, depthMax: 3000, zone: "bathypelagic", emoji: "🐍", color: "#1e1b4b", size: 0.7, wikiTitle: "Saccopharyngiformes" },
  { id: "barreleye", name: "Barreleye fish", rarity: "rare", spawnWeight: 2, depthMin: 400, depthMax: 1500, zone: "mesopelagic", emoji: "👁", color: "#22d3ee", size: 0.4, wikiTitle: "Barreleye" },
  { id: "vampire_squid", name: "Vampire squid", rarity: "rare", spawnWeight: 1, depthMin: 600, depthMax: 1200, zone: "mesopelagic", emoji: "🦑", color: "#881337", size: 0.55, wikiTitle: "Vampire squid" },
  { id: "blobfish", name: "Blobfish", rarity: "legendary", spawnWeight: 1, depthMin: 600, depthMax: 1200, zone: "bathypelagic", emoji: "🫠", color: "#fda4af", size: 0.5, wikiTitle: "Blobfish" },
  { id: "coelacanth", name: "Coelacanth", rarity: "legendary", spawnWeight: 1, depthMin: 150, depthMax: 700, zone: "mesopelagic", emoji: "🐟", color: "#365314", size: 1.0, wikiTitle: "Coelacanth" },
  { id: "oarfish", name: "Giant oarfish", rarity: "legendary", spawnWeight: 1, depthMin: 200, depthMax: 1000, zone: "mesopelagic", emoji: "🐉", color: "#94a3b8", size: 1.5, wikiTitle: "Giant oarfish" },
  { id: "sunfish", name: "Ocean sunfish", rarity: "rare", spawnWeight: 1, depthMin: 0, depthMax: 600, zone: "epipelagic", emoji: "🐟", color: "#64748b", size: 1.3, wikiTitle: "Ocean sunfish" },
  { id: "marlin", name: "Blue marlin", rarity: "uncommon", spawnWeight: 2, depthMin: 0, depthMax: 200, zone: "epipelagic", emoji: "🐟", color: "#1e40af", size: 1.1, wikiTitle: "Atlantic blue marlin" },
  { id: "swordfish", name: "Swordfish", rarity: "uncommon", spawnWeight: 2, depthMin: 0, depthMax: 900, zone: "epipelagic", emoji: "🐟", color: "#334155", size: 1.15, wikiTitle: "Swordfish" },
  { id: "sailfish", name: "Sailfish", rarity: "uncommon", spawnWeight: 2, depthMin: 0, depthMax: 200, zone: "epipelagic", emoji: "🐟", color: "#0ea5e9", size: 1.05, wikiTitle: "Sailfish" },
  { id: "beluga", name: "Beluga whale", rarity: "rare", spawnWeight: 1, depthMin: 0, depthMax: 800, zone: "epipelagic", emoji: "🐋", color: "#f8fafc", size: 1.4, wikiTitle: "Beluga whale" },
  { id: "narwhal", name: "Narwhal", rarity: "legendary", spawnWeight: 1, depthMin: 0, depthMax: 1500, zone: "epipelagic", emoji: "🦄", color: "#94a3b8", size: 1.3, wikiTitle: "Narwhal" },
  { id: "walrus", name: "Walrus", rarity: "uncommon", spawnWeight: 2, depthMin: 0, depthMax: 100, zone: "epipelagic", emoji: "🦭", color: "#a8a29e", size: 1.2, wikiTitle: "Walrus" },
  { id: "seal", name: "Harbor seal", rarity: "common", spawnWeight: 5, depthMin: 0, depthMax: 150, zone: "epipelagic", emoji: "🦭", color: "#78716c", size: 0.85, wikiTitle: "Harbor seal" },
  { id: "sea_otter", name: "Sea otter", rarity: "uncommon", spawnWeight: 2, depthMin: 0, depthMax: 30, zone: "reef", emoji: "🦦", color: "#92400e", size: 0.7, wikiTitle: "Sea otter" },
  { id: "manatee", name: "West Indian manatee", rarity: "rare", spawnWeight: 1, depthMin: 0, depthMax: 20, zone: "epipelagic", emoji: "🐋", color: "#a3a3a3", size: 1.1, wikiTitle: "West Indian manatee" },
  { id: "dugong", name: "Dugong", rarity: "rare", spawnWeight: 1, depthMin: 0, depthMax: 40, zone: "reef", emoji: "🐋", color: "#d6d3d1", size: 1.0, wikiTitle: "Dugong" },
  { id: "pufferfish", name: "Pufferfish", rarity: "common", spawnWeight: 6, depthMin: 2, depthMax: 80, zone: "reef", emoji: "🐡", color: "#fde68a", size: 0.5, wikiTitle: "Tetraodontidae" },
  { id: "triggerfish", name: "Triggerfish", rarity: "common", spawnWeight: 5, depthMin: 2, depthMax: 60, zone: "reef", emoji: "🐠", color: "#2dd4bf", size: 0.55, wikiTitle: "Triggerfish" },
  { id: "barracuda", name: "Great barracuda", rarity: "uncommon", spawnWeight: 3, depthMin: 0, depthMax: 100, zone: "reef", emoji: "🐟", color: "#71717a", size: 0.95, wikiTitle: "Great barracuda" },
  { id: "flounder", name: "Flounder", rarity: "common", spawnWeight: 5, depthMin: 5, depthMax: 200, zone: "reef", emoji: "🐟", color: "#a16207", size: 0.55, wikiTitle: "Flounder" },
  { id: "seabass", name: "European seabass", rarity: "common", spawnWeight: 5, depthMin: 0, depthMax: 100, zone: "epipelagic", emoji: "🐟", color: "#cbd5e1", size: 0.65, wikiTitle: "European seabass" },
  { id: "pollock", name: "Alaska pollock", rarity: "common", spawnWeight: 5, depthMin: 0, depthMax: 300, zone: "epipelagic", emoji: "🐟", color: "#e2e8f0", size: 0.6, wikiTitle: "Alaska pollock" },
  { id: "salmon", name: "Atlantic salmon", rarity: "uncommon", spawnWeight: 3, depthMin: 0, depthMax: 200, zone: "epipelagic", emoji: "🐟", color: "#f87171", size: 0.7, wikiTitle: "Atlantic salmon" },
  { id: "flying_fish", name: "Flying fish", rarity: "common", spawnWeight: 5, depthMin: 0, depthMax: 40, zone: "epipelagic", emoji: "🐟", color: "#7dd3fc", size: 0.45, wikiTitle: "Flying fish" },
  { id: "barnacle", name: "Goose barnacle", rarity: "common", spawnWeight: 4, depthMin: 0, depthMax: 10, zone: "reef", emoji: "🐚", color: "#fef3c7", size: 0.3, wikiTitle: "Goose barnacle" },
  { id: "sea_cucumber", name: "Sea cucumber", rarity: "common", spawnWeight: 5, depthMin: 5, depthMax: 200, zone: "reef", emoji: "🥒", color: "#166534", size: 0.4, wikiTitle: "Sea cucumber" },
  { id: "sea_slug", name: "Nudibranch", rarity: "uncommon", spawnWeight: 3, depthMin: 2, depthMax: 60, zone: "reef", emoji: "🐌", color: "#e879f9", size: 0.35, wikiTitle: "Nudibranch" },
  { id: "tube_worm", name: "Giant tube worm", rarity: "rare", spawnWeight: 1, depthMin: 2500, depthMax: 3500, zone: "abyssal", emoji: "🪱", color: "#ef4444", size: 0.8, wikiTitle: "Giant tube worm" },
  { id: "vent_crab", name: "Hydrothermal vent crab", rarity: "rare", spawnWeight: 1, depthMin: 2000, depthMax: 4000, zone: "abyssal", emoji: "🦀", color: "#fafafa", size: 0.5, wikiTitle: "Kiwa (crab)" },
  { id: "snailfish", name: "Mariana snailfish", rarity: "legendary", spawnWeight: 1, depthMin: 7000, depthMax: 11000, zone: "hadal", emoji: "🐟", color: "#fbcfe8", size: 0.35, wikiTitle: "Pseudoliparis swirei" },
  { id: "amphipod", name: "Deep-sea amphipod", rarity: "common", spawnWeight: 8, depthMin: 1000, depthMax: 8000, zone: "abyssal", emoji: "🦐", color: "#fda4af", size: 0.25, wikiTitle: "Amphipoda" },
  { id: "sea_pig", name: "Sea pig", rarity: "uncommon", spawnWeight: 2, depthMin: 1000, depthMax: 6000, zone: "abyssal", emoji: "🐷", color: "#fecdd3", size: 0.35, wikiTitle: "Sea pig" },
  { id: "isopod", name: "Giant isopod", rarity: "rare", spawnWeight: 1, depthMin: 170, depthMax: 2200, zone: "bathypelagic", emoji: "🪲", color: "#d4d4d8", size: 0.6, wikiTitle: "Giant isopod" },
  { id: "tripod_fish", name: "Tripod fish", rarity: "rare", spawnWeight: 1, depthMin: 800, depthMax: 5000, zone: "abyssal", emoji: "🐟", color: "#78716c", size: 0.5, wikiTitle: "Tripod fish" },
  { id: "sea_spider", name: "Sea spider", rarity: "uncommon", spawnWeight: 2, depthMin: 0, depthMax: 7000, zone: "abyssal", emoji: "🕷", color: "#fef9c3", size: 0.3, wikiTitle: "Sea spider" },
];

const NAMED_SPAWNS = [
  { speciesId: "blue_whale", x: 12, y: -8, depthM: 80 },
  { speciesId: "whale_shark", x: -22, y: 15, depthM: 40 },
  { speciesId: "giant_squid", x: 45, y: -30, depthM: 900 },
  { speciesId: "coelacanth", x: -40, y: -20, depthM: 400 },
  { speciesId: "narwhal", x: 5, y: 38, depthM: 50 },
  { speciesId: "orca", x: -15, y: 5, depthM: 120 },
  { speciesId: "manta", x: 28, y: -12, depthM: 25 },
  { speciesId: "anglerfish", x: 60, y: 50, depthM: 2200 },
  { speciesId: "snailfish", x: -55, y: -48, depthM: 9500 },
  { speciesId: "blobfish", x: 38, y: 42, depthM: 900 },
];

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickSpecies(rand) {
  const total = SPECIES.reduce((s, sp) => s + sp.spawnWeight, 0);
  let r = rand() * total;
  for (const sp of SPECIES) {
    r -= sp.spawnWeight;
    if (r <= 0) return sp;
  }
  return SPECIES[0];
}

function zoneLabel(z) {
  const map = {
    epipelagic: "Sunlight zone (0–200 m)",
    reef: "Coral reef & coast",
    mesopelagic: "Twilight zone (200–1000 m)",
    bathypelagic: "Midnight zone (1000–4000 m)",
    abyssal: "Abyssal plain (4000–6000 m)",
    hadal: "Hadal zone (6000+ m)",
  };
  return map[z] || z;
}

function positionInSector(rand, sx, sy) {
  const half = WORLD_KM;
  const x = -half + sx * SECTOR_KM + rand() * SECTOR_KM;
  const y = -half + sy * SECTOR_KM + rand() * SECTOR_KM;
  return { x, y };
}

function positionNearCenter(rand, center, radiusScale = 1) {
  const ang = rand() * Math.PI * 2;
  const d = rand() * center.r * radiusScale;
  return { x: center.x + Math.cos(ang) * d, y: center.y + Math.sin(ang) * d };
}

function pickPosition(rand, sp, sector = null) {
  if (sector) return positionInSector(rand, sector.sx, sector.sy);

  if (sp.zone === "reef" && rand() < 0.45) {
    const c = REEF_CENTERS[Math.floor(rand() * REEF_CENTERS.length)];
    return positionNearCenter(rand, c);
  }

  if (sp.zone === "abyssal" || sp.zone === "hadal" || sp.zone === "bathypelagic") {
    const c = DEEP_CENTERS[Math.floor(rand() * DEEP_CENTERS.length)];
    return positionNearCenter(rand, c, 0.85 + rand() * 0.35);
  }

  if (sp.zone === "mesopelagic" && rand() < 0.4) {
    const c = DEEP_CENTERS[Math.floor(rand() * DEEP_CENTERS.length)];
    return positionNearCenter(rand, c, 0.5 + rand() * 0.5);
  }

  return { x: (rand() - 0.5) * WORLD_KM * 2, y: (rand() - 0.5) * WORLD_KM * 2 };
}

function tooClose(x, y, list) {
  for (const c of list) {
    if (Math.hypot(c.x - x, c.y - y) < MIN_DIST_KM) return true;
  }
  return false;
}

function main() {
  const rand = mulberry32(2026);
  const byId = Object.fromEntries(SPECIES.map((s) => [s.id, s]));
  const creatures = [];
  let id = 0;

  for (const n of NAMED_SPAWNS) {
    const sp = byId[n.speciesId];
    if (!sp) continue;
    creatures.push(makeCreature(id++, sp, n.x, n.y, n.depthM, true));
  }

  for (let sx = 0; sx < SECTORS_PER_AXIS; sx++) {
    for (let sy = 0; sy < SECTORS_PER_AXIS; sy++) {
      let placed = 0;
      let tries = 0;
      while (placed < MIN_PER_SECTOR && tries < MIN_PER_SECTOR * 40) {
        tries += 1;
        const sp = pickSpecies(rand);
        const { x, y } = pickPosition(rand, sp, { sx, sy });
        if (tooClose(x, y, creatures)) continue;
        const depthM = Math.round(sp.depthMin + rand() * (sp.depthMax - sp.depthMin));
        creatures.push(makeCreature(id++, sp, x, y, depthM, false));
        placed += 1;
      }
    }
  }

  let attempts = 0;
  while (creatures.length < TARGET && attempts < TARGET * 80) {
    attempts += 1;
    const sp = pickSpecies(rand);
    const { x, y } = pickPosition(rand, sp);
    if (tooClose(x, y, creatures)) continue;
    const depthM = Math.round(sp.depthMin + rand() * (sp.depthMax - sp.depthMin));
    creatures.push(makeCreature(id++, sp, x, y, depthM, false));
  }

  const payload = {
    updatedAt: Date.now(),
    count: creatures.length,
    worldKm: WORLD_KM,
    maxDepthM: 11000,
    speciesCount: SPECIES.length,
    sparse: true,
    species: SPECIES.map((s) => ({
      id: s.id,
      name: s.name,
      rarity: s.rarity,
      zone: s.zone,
      zoneLabel: zoneLabel(s.zone),
      depthMin: s.depthMin,
      depthMax: s.depthMax,
      emoji: s.emoji,
      color: s.color,
      wikiTitle: s.wikiTitle,
    })),
    creatures,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload), "utf8");
  console.log(`Wrote ${creatures.length} sparse encounters (${SPECIES.length} species) to ${OUT}`);
}

function makeCreature(numId, sp, x, y, depthM, featured) {
  return {
    id: `creature_${numId}`,
    speciesId: sp.id,
    name: sp.name,
    rarity: sp.rarity,
    zone: sp.zone,
    x: Math.round(x * 100) / 100,
    y: Math.round(y * 100) / 100,
    depthM,
    emoji: sp.emoji,
    color: sp.color,
    size: sp.size,
    wikiTitle: sp.wikiTitle,
    featured,
  };
}

main();