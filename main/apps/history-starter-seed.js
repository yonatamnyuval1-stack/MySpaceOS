const USER_AGENT = "MySpaceHistory/1.0 (Educational desktop app; Electron)";

const STARTER_FIGURES = [
  { era: "ancient", titles: ["Alexander the Great", "Cleopatra", "Julius Caesar", "Augustus", "Socrates", "Plato", "Aristotle", "Hannibal", "Confucius", "Ashoka"] },
  { era: "medieval", titles: ["Charlemagne", "Genghis Khan", "Saladin", "William the Conqueror", "Joan of Arc", "Marco Polo"] },
  { era: "early", titles: ["Leonardo da Vinci", "Michelangelo", "Martin Luther", "Elizabeth I", "Isaac Newton", "Galileo Galilei", "William Shakespeare"] },
  { era: "modern", titles: ["Napoleon", "George Washington", "Thomas Jefferson", "Abraham Lincoln", "Queen Victoria", "Karl Marx", "Charles Darwin", "Nikola Tesla"] },
  { era: "twentieth", titles: ["Albert Einstein", "Winston Churchill", "Franklin D. Roosevelt", "Mahatma Gandhi", "Adolf Hitler", "Joseph Stalin", "Martin Luther King Jr.", "Nelson Mandela", "Marie Curie", "Pablo Picasso"] },
  { era: "recent", titles: ["Barack Obama", "Steve Jobs", "Nelson Mandela", "Diana, Princess of Wales"] },
];

const STARTER_EVENTS = [
  { era: "ancient", titles: ["Battle of Marathon", "Battle of Thermopylae", "Assassination of Julius Caesar", "Fall of the Western Roman Empire"] },
  { era: "medieval", titles: ["Battle of Hastings", "Crusades", "Black Death", "Fall of Constantinople"] },
  { era: "early", titles: ["American Revolutionary War", "French Revolution", "Industrial Revolution"] },
  { era: "modern", titles: ["American Civil War", "World War I", "Russian Revolution", "World War II", "Holocaust", "Cold War"] },
  { era: "twentieth", titles: ["Moon landing", "Fall of the Berlin Wall", "September 11 attacks"] },
  { era: "recent", titles: ["Arab Spring", "COVID-19 pandemic"] },
];

async function wikiApi(params) {
  const clean = { format: "json" };
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") clean[k] = v;
  }
  const url = `https://en.wikipedia.org/w/api.php?${new URLSearchParams(clean)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`Wikipedia API ${res.status}`);
  return res.json();
}

async function enrichTitles(entries, type) {
  const items = [];
  for (let i = 0; i < entries.length; i += 40) {
    const chunk = entries.slice(i, i + 40);
    const data = await wikiApi({
      action: "query",
      titles: chunk.map((e) => e.title).join("|"),
      prop: "pageimages|pageprops|description",
      piprop: "thumbnail",
      pithumbsize: 400,
      ppprop: "wikibase_item",
    });
    for (const p of Object.values(data.query?.pages || {})) {
      if (p.missing) continue;
      const meta = chunk.find((e) => e.title === p.title);
      if (!meta) continue;
      items.push({
        id: p.pageprops?.wikibase_item || `WP_${p.pageid}`,
        type,
        name: p.title.replace(/_/g, " "),
        birth: "",
        death: "",
        birthYear: null,
        deathYear: null,
        date: "",
        year: null,
        era: meta.era,
        occupation: "",
        country: "",
        location: "",
        eventType: type === "event" ? "Historical event" : "",
        description: p.description || "",
        image: p.thumbnail?.source || "",
        wikiTitle: p.title,
      });
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return items;
}

async function buildStarterCache() {
  const figEntries = STARTER_FIGURES.flatMap((g) => g.titles.map((title) => ({ title, era: g.era })));
  const evEntries = STARTER_EVENTS.flatMap((g) => g.titles.map((title) => ({ title, era: g.era })));
  const figures = await enrichTitles(figEntries, "figure");
  const events = await enrichTitles(evEntries, "event");
  return {
    updatedAt: Date.now(),
    source: "wikipedia-starter",
    figures,
    events,
  };
}

module.exports = { buildStarterCache };
