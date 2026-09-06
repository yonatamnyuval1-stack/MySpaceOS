const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "data", "space-nasa-reports.json");
const MISSIONS_FILE = path.join(__dirname, "..", "data", "space-nasa-missions.json");
const EXISTING = path.join(__dirname, "..", "data", "space-nasa-reports.json");

function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function report(base) {
  return {
    id: base.id,
    title: base.title,
    year: base.year,
    category: base.category,
    agency: base.agency || "NASA",
    summary: base.summary,
    highlights: base.highlights || [],
    pages: base.pages || "",
    tags: base.tags || [],
    links: { ntrs: "https://ntrs.nasa.gov/", nasa: base.nasa || "", ...(base.links || {}) },
    missionId: base.missionId ?? null,
  };
}

const CURATED = [
  ["Apollo 7", 1968, "human-spaceflight", "First crewed Apollo flight: Earth orbit checkout of Command and Service Module after Apollo 1 fire."],
  ["Apollo 8", 1968, "human-spaceflight", "First humans to orbit the Moon: Earthrise photography and lunar navigation demonstration."],
  ["Apollo 9", 1969, "human-spaceflight", "Lunar Module tested in Earth orbit: rendezvous and EVA with Spider and Gumdrop."],
  ["Apollo 10", 1969, "human-spaceflight", "Dress rehearsal to 15.4 km above lunar surface: Snoopy LM ascent stage disposal test."],
  ["Apollo 12", 1969, "human-spaceflight", "Precision landing near Surveyor 3: lightning strike at launch and dual EVAs on Ocean of Storms."],
  ["Apollo 13", 1970, "human-spaceflight", "In-flight emergency: oxygen tank explosion, loop around Moon, safe Earth return."],
  ["Apollo 14", 1971, "human-spaceflight", "Fra Mauro highlands: Alan Shepard golf shot, modular equipment transporter, 42.9 kg samples."],
  ["Apollo 15", 1971, "human-spaceflight", "First J-mission: Hadley–Apennine, Lunar Roving Vehicle, extended surface science."],
  ["Apollo 16", 1972, "human-spaceflight", "Descartes Highlands: highlands volcanism study, Cassegrain UV camera from surface."],
  ["Gemini 3", 1965, "human-spaceflight", "First crewed Gemini: orbital maneuvering and multi-day life support validation."],
  ["Gemini 4", 1965, "human-spaceflight", "First U.S. EVA: Ed White spacewalk; long-duration crew endurance."],
  ["Gemini 7", 1965, "human-spaceflight", "14-day endurance record: rendezvous target for Gemini 6A."],
  ["Gemini 8", 1966, "human-spaceflight", "First docking (Agena): in-flight abort after stuck thruster."],
  ["Gemini 12", 1966, "human-spaceflight", "Final Gemini: EVA improvements, closed-loop station-keeping."],
  ["Mercury-Redstone 3", 1961, "human-spaceflight", "Alan Shepard suborbital flight: Freedom 7, 15-minute ballistic arc."],
  ["Mercury-Atlas 6", 1962, "human-spaceflight", "John Glenn first U.S. orbital flight: Friendship 7, three orbits."],
  ["STS-1 Columbia", 1981, "human-spaceflight", "First Space Shuttle flight: orbital test of reusable orbiter and tiles."],
  ["STS-5", 1982, "human-spaceflight", "First operational Shuttle: deployed two commercial satellites."],
  ["STS-41-B", 1984, "human-spaceflight", "First untethered EVA (MMU): Bruce McCandless free flight."],
  ["STS-51-L Challenger", 1986, "human-spaceflight", "Rogers Commission report: accident investigation and safety culture reforms."],
  ["STS-26 Return to Flight", 1988, "human-spaceflight", "Shuttle return after Challenger: redesigned SRB joints and crew escape."],
  ["STS-31 Hubble deploy", 1990, "science", "Discovery deploys Hubble: optical aberration later corrected on STS-61."],
  ["STS-61 Hubble servicing", 1993, "science", "First Hubble repair: COSTAR and WFPC2 restore planned resolution."],
  ["STS-95", 1998, "human-spaceflight", "John Glenn returns to orbit: aging research on Discovery."],
  ["STS-107 Columbia", 2003, "human-spaceflight", "Columbia Accident Investigation Board: foam strike and re-entry breach."],
  ["STS-125 final Hubble servicing", 2009, "science", "Last crewed Hubble repair: ACS repair, new instruments, mission extension."],
  ["Skylab 1", 1973, "human-spaceflight", "Orbital workshop: solar physics, Earth resources, human adaptation 28–84 days."],
  ["Mariner 4", 1965, "planetary", "First close-up Mars images: cratered terrain, thin atmosphere confirmed."],
  ["Mariner 9", 1971, "planetary", "First Mars orbiter: global dust storm, Olympus Mons and Valles Marineris."],
  ["Viking 1", 1976, "planetary", "First successful Mars lander: biology experiments and meteorology."],
  ["Pioneer 10", 1973, "planetary", "First Jupiter flyby: radiation belts, exit toward interstellar space."],
  ["Pioneer 11", 1979, "planetary", "Saturn ring-plane crossing: first close Saturn images."],
  ["Galileo", 1995, "planetary", "Jupiter orbiter: Io volcanism, Europa ice shell, probe entry 1995."],
  ["Magellan", 1990, "planetary", "Venus radar mapper: 98% surface imaged, global topography."],
  ["Mars Pathfinder", 1997, "planetary", "Sojourner rover: airbag landing, rock chemistry at Ares Vallis."],
  ["Mars Odyssey", 2001, "planetary", "Gamma-ray spectrometer: subsurface water ice at high latitudes."],
  ["Mars Reconnaissance Orbiter", 2006, "planetary", "HiRISE cm-scale imaging: recurring slope lineae, landing site certification."],
  ["MAVEN", 2014, "planetary", "Mars upper atmosphere: solar wind stripping of atmosphere over time."],
  ["InSight", 2018, "planetary", "Mars geophysics: SEIS marsquakes, heat flow probe attempt."],
  ["Lunar Reconnaissance Orbiter", 2009, "planetary", "Moon mapping: polar volatiles, Apollo site preservation, Artemis support."],
  ["LCROSS", 2009, "planetary", "Lunar south pole impact: water ice confirmed in Cabeus crater ejecta."],
  ["Chandrayaan-1 M3 coordination", 2009, "planetary", "NASA instrument on Indian orbiter: lunar water signature at poles."],
  ["New Horizons", 2015, "planetary", "Pluto flyby: Tombaugh Regio heart, Charon geology, Kuiper belt object Arrokoth 2019."],
  ["Juno", 2016, "planetary", "Jupiter polar orbits: deep atmosphere water, Great Red Spot depth, magnetosphere."],
  ["Lucy", 2021, "planetary", "Jupiter Trojan asteroids: fossil records of outer planet formation."],
  ["Psyche", 2023, "planetary", "Metal asteroid mission: planned orbiter of 16 Psyche."],
  ["Stardust", 2006, "planetary", "Comet Wild 2 sample return: aerogel capture, interstellar dust tracks."],
  ["Deep Impact", 2005, "planetary", "Comet Tempel 1 impactor: excavated subsurface volatiles."],
  ["NEAR Shoemaker", 2001, "planetary", "Eros asteroid orbiter and landing: first NEA soft touchdown."],
  ["Dawn", 2015, "planetary", "Vesta and Ceres: protoplanet differentiation, bright spots on Ceres."],
  ["MESSENGER", 2015, "planetary", "Mercury orbiter: ice in polar craters, volcanic plains, iron core."],
  ["LADEE", 2014, "planetary", "Lunar exosphere: dust and sodium exosphere variability."],
  ["GRAIL", 2012, "planetary", "Lunar gravity map: crustal thickness and impact basin structure."],
  ["TESS", 2018, "science", "Exoplanet transit survey: all-sky bright-star planet candidates."],
  ["Swift", 2004, "science", "Gamma-ray burst rapid follow-up: afterglow localization."],
  ["Fermi", 2008, "science", "Gamma-ray sky survey: blazars, pulsars, terrestrial flashes."],
  ["IXPE", 2021, "science", "X-ray polarization: black hole accretion and pulsar wind geometry."],
  ["NICER", 2017, "science", "Neutron star timing on ISS: mass–radius constraints, pulsar navigation."]
  ["NuSTAR", 2012, "science", "Hard X-ray focusing optics: black hole reflection spectra."],
  ["WISE / NEOWISE", 2010, "science", "Infrared all-sky survey: brown dwarfs, asteroid diameters revived."],
  ["COBE", 1992, "science", "Cosmic microwave background: universe blackbody, hot/cold spots."],
  ["WMAP", 2003, "science", "CMB precision: age, flatness, dark energy fraction."],
  ["Planck (NASA partnership)", 2013, "science", "CMB polarization: cosmological parameters to high precision."],
  ["LIGO first detection", 2016, "science", "Gravitational waves: GW150914 binary black hole merger."],
  ["IceCube neutrino alert", 2017, "science", "Multimessenger astronomy: high-energy neutrino with Fermi blazar TXS 0506+056."],
  ["Landsat 1", 1972, "earth-science", "First Earth Resources Technology Satellite: land use change monitoring begins."],
  ["Landsat 8", 2013, "earth-science", "OLI and TIRS: thermal infrared for agriculture and water."],
  ["Landsat 9", 2021, "earth-science", "Data continuity: joint USGS/NASA operations to 2030s."],
  ["Terra", 1999, "earth-science", "Morning constellation flagship: MODIS aerosols, MISR clouds."],
  ["Aqua", 2002, "earth-science", "Water cycle: AMSR-E, AIRS temperature/humidity profiles."],
  ["Aura", 2004, "earth-science", "Atmospheric chemistry: OMI ozone, MLS stratospheric composition."],
  ["GRACE", 2002, "earth-science", "Gravity recovery: ice sheet mass loss, groundwater depletion."]
  ["GRACE-FO", 2018, "earth-science", "Follow-on: continued ice and water mass trends."],
  ["ICESat-2", 2018, "earth-science", "Laser altimetry: ice sheet elevation change, forest canopy height."],
  ["GOES-R series", 2016, "earth-science", "Geostationary weather: lightning mapper, hurricane rapid scan."],
  ["JPSS-1 NOAA-20", 2017, "earth-science", "Polar orbiter: VIIRS day/night band, ozone mapping."],
  ["SMAP", 2015, "earth-science", "Soil moisture active/passive: drought and flood monitoring."],
  ["OCO-2", 2014, "earth-science", "Column CO₂: fossil fuel and biosphere signals."],
  ["CALIPSO", 2006, "earth-science", "Lidar cloud/aerosol vertical profiles: climate forcing."],
  ["CERES", 2000, "earth-science", "Earth radiation budget: reflected shortwave and emitted longwave."],
  ["NEO Surveyor concept", 2024, "planetary-defense", "Infrared space telescope: hazardous asteroid population completeness."],
  ["Planetary Defense Conference", 2023, "planetary-defense", "Biennial international exercise: impact scenarios and agency coordination."],
  ["Astro2010 Decadal", 2010, "policy", "New Worlds, New Horizons: JWST priority, WFIRST concept."],
  ["Heliophysics 2019 Decadal", 2019, "policy", "DRIVE initiative: PUNCH, TRACERS, space weather research."],
  ["Earth Science 2017 Decadal", 2018, "policy", "Thriving on Our Changing Planet: Earth System Observatory design."],
  ["Biological and Physical Sciences Decadal", 2023, "policy", "Research for space exploration: microgravity fundamentals."],
  ["NASA Authorization Act summary", 2022, "policy", "Congressional direction: Artemis timelines and ISS transition."],
  ["Commercial LEO Destinations", 2024, "policy", "Private space stations after ISS: NASA anchor tenant strategy."],
  ["Nuclear propulsion DRACO", 2024, "technology", "Demonstration Rocket for Agile Cislunar Operations: fission reactor in orbit."],
  ["Advanced Air Mobility", 2024, "technology", "Urban air mobility: NASA electrified aircraft testbed."],
  ["Quiet Supersonic X-59", 2024, "technology", "Low-boom flight validation: community response studies."],
  ["Europa Clipper science plan", 2024, "planetary", "Mission-level science goals: habitability trade studies pre-launch."],
  ["Dragonfly Phase E", 2024, "planetary", "Titan rotorcraft: pre-formulation to implementation transition."],
  ["Gateway logistics", 2024, "human-spaceflight", "Lunar orbit station: power and propulsion, HALO module."],
  ["Commercial Crew Program", 2024, "human-spaceflight", "SpaceX Crew Dragon and Boeing Starliner certification."],
  ["Space Launch System Block 1", 2024, "human-spaceflight", "Mega rocket: Artemis mass to TLI capability."],
  ["Orion EFT-1", 2014, "human-spaceflight", "Uncrewed high-apogee test: heat shield and avionics."],
  ["Orion Ascent Abort-2", 2019, "human-spaceflight", "Launch abort motor test: crew escape from pad."],
  ["Ingenuity Mars Helicopter", 2021, "planetary", "Technology demo: 72 flights, aerial scout for Perseverance."],
  ["MOXIE demonstration", 2021, "planetary", "Mars oxygen ISRU: electrolysis from CO₂ atmosphere."],
  ["James Webb commissioning", 2022, "science", "Mirror alignment and instrument checkout at L2."],
  ["Roman Space Telescope formulation", 2024, "science", "Wide-field infrared: dark energy and exoplanet microlensing."],
  ["Laser Interferometer Space Antenna study", 2024, "science", "ESA/NASA L3: gravitational wave low-frequency band."],
  ["Human Research Program", 2024, "human-spaceflight", "Radiation, bone loss, behavioral health for Mars crews."],
  ["Space Biology Program", 2024, "science", "Plants and microbes in microgravity: closed-loop life support."],
  ["Physical Sciences Program", 2024, "science", "Combustion, fluids, materials: ISS rack experiments."],
  ["Technology Transfer annual", 2023, "technology", "Patents and licenses: NASA spinoffs to industry."],
  ["Small Business Innovation Research", 2024, "technology", "SBIR/STTR: commercialization of space tech."],
  ["Cubesat Launch Initiative", 2024, "technology", "Educational and science CubeSats: rideshare opportunities."],
  ["Deep Space Network status", 2024, "technology", "70 m dishes: support for interplanetary missions."],
  ["Space Communications and Navigation", 2024, "technology", "Laser comm relay: LCRD and future Mars links."],
  ["Planetary Data System", 2024, "reference", "Archived mission data: standards for science archives."],
  ["HEASARC archive", 2024, "reference", "High-energy astrophysics data: X-ray and gamma-ray catalogs."],
  ["MAST archive", 2024, "reference", "Mikulski Archive: Hubble, JWST, Kepler, TESS holdings."],
  ["Physical Sciences Data Archive", 2024, "reference", "Microgravity experiment results: open access."],
];

function curatedReports() {
  return CURATED.map(([title, year, category, summary], i) =>
    report({
      id: slug(`${title}-${year}-report`),
      title: `${title} — Mission Report`,
      year,
      category,
      summary,
      highlights: [
        "Official or program-level documentation",
        "Engineering and science results summarized",
        "Available via NASA archives and NTRS",
      ],
      tags: [category.split("-")[0], String(year)],
      nasa: "https://www.nasa.gov/",
      missionId: null,
    })
  );
}

function missionDerivedReports(missions) {
  const out = [];
  const typeToCategory = {
    human: "human-spaceflight",
    probe: "planetary",
    rover: "planetary",
    station: "human-spaceflight",
    observatory: "science",
    rotorcraft: "planetary",
  };

  for (const m of missions) {
    const cat = typeToCategory[m.type] || "science";
    const mid = m.id;
    const nasa = m.links?.nasa || "https://www.nasa.gov/";

    out.push(
      report({
        id: `${mid}-mission-report`,
        title: `${m.name} — Mission Report`,
        year: parseInt(String(m.era).slice(0, 4), 10) || 2020,
        category: cat,
        agency: m.agency || "NASA",
        summary: m.summary || `Official documentation and results for ${m.name}.`,
        highlights: (m.highlights || []).slice(0, 3),
        tags: [m.type || "mission", (m.target || "space").toLowerCase().replace(/\s+/g, "-")],
        links: { nasa, ntrs: "https://ntrs.nasa.gov/" },
        missionId: mid,
      })
    );

    out.push(
      report({
        id: `${mid}-science-summary`,
        title: `${m.name} — Science Results Summary`,
        year: Math.min(2024, (parseInt(String(m.era).slice(0, 4), 10) || 2010) + 2),
        category: cat === "human-spaceflight" ? "science" : cat,
        agency: m.agency || "NASA",
        summary: `Peer-reviewed and mission science synthesis for ${m.name}: instruments, datasets, and key discoveries.`,
        highlights: [
          "Instrument calibration and data release notes",
          "Peer-reviewed publications catalog",
          "Open data on NASA archives",
        ],
        tags: ["science", "data", m.type || "mission"],
        links: { nasa, ntrs: "https://ntrs.nasa.gov/" },
        missionId: mid,
      })
    );

    if (m.physics && Object.keys(m.physics).length) {
      out.push(
        report({
          id: `${mid}-technical-supplement`,
          title: `${m.name} — Technical & Trajectory Supplement`,
          year: parseInt(String(m.era).slice(0, 4), 10) || 2020,
          category: "technology",
          agency: m.agency || "NASA",
          summary: `Engineering parameters, propulsion, and operations data for ${m.name}: mass, delta-V, power, and orbital constraints.`,
          highlights: Object.entries(m.physics)
            .slice(0, 3)
            .map(([k, v]) => `${k}: ${v}`),
          tags: ["engineering", "trajectory"],
          links: { nasa, ntrs: "https://ntrs.nasa.gov/" },
          missionId: mid,
        })
      );
    }
  }
  return out;
}

function issAnnualReports() {
  const out = [];
  for (let y = 2000; y <= 2024; y++) {
    out.push(
      report({
        id: `iss-research-${y}`,
        title: `ISS Research Summary ${y}`,
        year: y,
        category: "human-spaceflight",
        summary: `Annual overview of International Space Station research in ${y} — biology, materials, technology, and Earth science.`,
        highlights: ["Utilization statistics", "Peer-reviewed papers from ISS", "New facility deployments"],
        tags: ["iss", "microgravity", String(y)],
        links: { nasa: "https://www.nasa.gov/iss-research/", ntrs: "https://ntrs.nasa.gov/" },
        missionId: "iss-program",
      })
    );
  }
  return out;
}

function spinoffReports() {
  const out = [];
  for (let y = 1976; y <= 2024; y++) {
    out.push(
      report({
        id: `nasa-spinoff-${y}`,
        title: `NASA Spinoff ${y}`,
        year: y,
        category: "technology",
        summary: `Technology transfer publication for ${y}: space R&D adapted to commercial products in health, transport, energy, and computing.`,
        highlights: ["Industry partnerships", "Patent highlights", "Economic impact stories"],
        tags: ["spinoff", "technology-transfer", String(y)],
        links: { nasa: "https://spinoff.nasa.gov/", ntrs: "https://ntrs.nasa.gov/" },
        missionId: null,
      })
    );
  }
  return out;
}

function apolloScienceReports() {
  const missions = [
    [11, 1969, "Sea of Tranquility"],
    [12, 1969, "Ocean of Storms"],
    [14, 1971, "Fra Mauro"],
    [15, 1971, "Hadley–Apennine"],
    [16, 1972, "Descartes"],
    [17, 1972, "Taurus–Littrow"],
  ];
  return missions.flatMap(([n, year, site]) => [
    report({
      id: `apollo-${n}-preliminary-science`,
      title: `Apollo ${n} — Preliminary Science Report`,
      year: year + 1,
      category: "planetary",
      summary: `Lunar sample and surface science from Apollo ${n} at ${site}: geology, geochemistry, and experiment results.`,
      highlights: ["Sample catalog and allocation", "ALSEP experiment data", "Traverse maps and photography"],
      tags: ["apollo", "moon", "samples"],
      links: { nasa: `https://www.nasa.gov/mission/apollo-${n}/`, ntrs: "https://ntrs.nasa.gov/" },
      missionId: `apollo-${n}`,
    }),
    report({
      id: `apollo-${n}-ALSEP`,
      title: `Apollo ${n} — ALSEP Experiment Status`,
      year,
      category: "science",
      summary: `Apollo Lunar Surface Experiments Package operations for Apollo ${n}: passive seismic, magnetometer, and heat flow where deployed.`,
      highlights: ["Deployment timeline", "Data return until shutdown", "Long-term geophysical monitoring"],
      tags: ["apollo", "geophysics", "ALSEP"],
      links: { ntrs: "https://ntrs.nasa.gov/", nasa: "https://www.nasa.gov/" },
      missionId: `apollo-${n}`,
    }),
  ]);
}

function shuttleMissionReports() {
  const flights = [
    ["STS-2", 1981, "Columbia second flight: thermal tile issues"],
    ["STS-3", 1982, "Columbia: first shuttle spacewalk preparation"],
    ["STS-7", 1983, "Challenger: first U.S. woman in space (Sally Ride)"],
    ["STS-8", 1983, "Night launch and landing demonstration"],
    ["STS-41-G", 1984, "Earth Radiation Budget Satellite deploy"],
    ["STS-51-D", 1985, "Satellite deployment anomalies"],
    ["STS-51-J", 1985, "First dedicated DOD Shuttle flight"],
    ["STS-61-A", 1985, "Spacelab D-1: West German payload specialist crew"],
    ["STS-30", 1989, "Magellan Venus radar mapper deploy"],
    ["STS-34", 1989, "Galileo Jupiter probe deploy"],
    ["STS-37", 1991, "Compton Gamma Ray Observatory deploy"],
    ["STS-49", 1992, "Intelsat VI capture and repair EVA"],
    ["STS-60", 1994, "First Russian cosmonaut on Shuttle"],
    ["STS-63", 1995, "Mir rendezvous: proximity operations"],
    ["STS-71", 1995, "First Shuttle–Mir docking"],
    ["STS-74", 1995, "Mir docking module attach"],
    ["STS-80", 1996, "Longest Shuttle mission: 17 days"],
    ["STS-85", 1997, "CRISTA-SPAS atmospheric limb sounding"],
    ["STS-88", 1998, "ISS Unity node: first station assembly"],
    ["STS-96", 1999, "ISS logistics: crane and tools"],
    ["STS-100", 2001, "Canadarm2 and Raffaello MPLM"],
    ["STS-109", 2002, "Hubble servicing mission 3B"],
    ["STS-114", 2005, "Return to Flight after Columbia: tile repair EVA"],
    ["STS-119", 2009, "ISS S6 truss and solar arrays"],
    ["STS-134", 2011, "Final flight of Endeavour: AMS-02 on ISS"],
    ["STS-135", 2011, "Final Shuttle mission: Atlantis ISS cargo"],
  ];
  return flights.map(([name, year, summary]) =>
    report({
      id: slug(`${name}-report`),
      title: `${name}: Mission Report`,
      year,
      category: "human-spaceflight",
      summary,
      highlights: ["Orbiter systems", "Payload operations", "Crew activity timeline"],
      tags: ["shuttle", name.toLowerCase()],
      links: { nasa: "https://www.nasa.gov/history/shuttle-program/", ntrs: "https://ntrs.nasa.gov/" },
      missionId: null,
    })
  );
}

function marsProgramReports() {
  const topics = [
    ["Mars exploration strategy", 2010, "Program-level goals for sample return and habitability"],
    ["Mars Sample Return architecture", 2022, "Earth Return Orbiter and Sample Retrieval Lander"],
    ["Mars helicopter extension", 2022, "Ingenuity operations beyond original 5 flights"],
    ["Jezero delta sedimentology", 2023, "Perseverance lake deposits and astrobiology potential"],
    ["Gale Crater stratigraphy", 2015, "Curiosity Mount Sharp climbing and habitability"],
    ["Phoenix polar ice", 2008, "Water ice confirmed at north polar landing site"],
    ["Spirit Columbia Hills", 2007, "Ancient hydrothermal silica deposits"],
    ["Opportunity endurance record", 2018, "15 years Meridiani Planum traverse summary"],
    ["Mars climate sounder", 2006, "MRO atmospheric temperature and dust profiles"],
    ["Mars subsurface radar SHARAD", 2007, "Layered polar deposits and buried ice"],
  ];
  return topics.map(([title, year, summary]) =>
    report({
      id: slug(`mars-${title}`),
      title: `Mars Program: ${title}`,
      year,
      category: "planetary",
      summary,
      highlights: ["Science team publications", "Open PDS data", "Cross-mission comparisons"],
      tags: ["mars", "robotics"],
      links: { nasa: "https://science.nasa.gov/planetary/mars/", ntrs: "https://ntrs.nasa.gov/" },
      missionId: "perseverance-mission",
    })
  );
}

function main() {
  const existing = readJson(EXISTING, { reports: [] });
  const missions = readJson(MISSIONS_FILE, { missions: [] }).missions || [];

  const batches = [
    existing.reports,
    curatedReports(),
    missionDerivedReports(missions),
    issAnnualReports(),
    spinoffReports(),
    apolloScienceReports(),
    shuttleMissionReports(),
    marsProgramReports(),
  ];

  const byId = new Map();
  for (const batch of batches) {
    for (const r of batch) {
      if (r?.id && r?.title) byId.set(r.id, r);
    }
  }

  const reports = [...byId.values()].sort((a, b) => (b.year || 0) - (a.year || 0));
  const payload = { updatedAt: Date.now(), count: reports.length, reports };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 0), "utf8");
  console.log(`Wrote ${reports.length} reports to ${OUT}`);
}

function readJson(file, fallback) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
  }
  return fallback;
}

main();