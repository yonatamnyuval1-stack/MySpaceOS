(function () {
  const U = (id) =>
    `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1920&h=1080&q=80`;

  const PHOTOS = [
    ["photo-001", "Mountain lake", "photo-1419242902214-272b3f66ee7a"],
    ["photo-002", "Misty forest", "photo-1426604966848-d7adac402bff"],
    ["photo-003", "Canyon ridge", "photo-1431794062232-2a99a5431c6c"],
    ["photo-004", "Fjord morning", "photo-1439066615861-d1af74d74000"],
    ["photo-005", "Forest path", "photo-1441974231531-c6227db76b6e"],
    ["photo-006", "Green meadow", "photo-1447752875215-b2761acb3c5d"],
    ["photo-007", "Mossy creek", "photo-1448375240586-882707db888b"],
    ["photo-008", "Foggy bridge", "photo-1449034446853-66c86144b0ad"],
    ["photo-009", "Glacier blue", "photo-1454496522488-7a8e488e8606"],
    ["photo-010", "Alpine peaks", "photo-1464822759023-fed622ff2c3b"],
    ["photo-011", "Flower meadow", "photo-1465146633011-14f8e0781093"],
    ["photo-012", "Rolling hills", "photo-1469474968028-56623f02e42e"],
    ["photo-013", "Mountain pass", "photo-1469854523086-cc02fe5d8800"],
    ["photo-014", "Autumn trail", "photo-1470071459604-3b5ec3a7fe05"],
    ["photo-015", "Golden hour", "photo-1470252649378-9c29740c9fa8"],
    ["photo-016", "Sunflowers", "photo-1470506028280-a011fb34b6f7"],
    ["photo-017", "Lakeside dawn", "photo-1470770841072-f978cf4d019e"],
    ["photo-018", "Green valley", "photo-1472214103451-9374bd1c798e"],
    ["photo-019", "Sahara dunes", "photo-1473580044384-7ba9967e16a0"],
    ["photo-020", "Coastal calm", "photo-1475924156734-496f6cac6ec1"],
    ["photo-021", "Pier sunset", "photo-1476514525535-07fb3b4ae5f1"],
    ["photo-022", "Iceland falls", "photo-1476610182048-b716b8518aae"],
    ["photo-023", "River city", "photo-1477959858617-67f85cf4f1df"],
    ["photo-024", "Rice terraces", "photo-1480796927426-f609979314bd"],
    ["photo-025", "Snow peaks", "photo-1482192505345-5655af888cc4"],
    ["photo-026", "Aurora lake", "photo-1483347756197-71ef80e95f73"],
    ["photo-027", "City towers", "photo-1486406146926-c627a92ad1ab"],
    ["photo-028", "Snow ridge", "photo-1486870591958-9b9d0d1dda99"],
    ["photo-029", "Tulip fields", "photo-1490750967868-88aa4486c946"],
    ["photo-030", "Mountain vista", "photo-1493246507139-91e8fad9978e"],
    ["photo-031", "Sakura path", "photo-1493976040374-85c8e12f0c0e"],
    ["photo-032", "Quiet lake", "photo-1494500764479-0c8f2919a3d8"],
    ["photo-033", "Sunrise field", "photo-1495616811223-4d98c6e9c869"],
    ["photo-034", "Palm sunset", "photo-1495954484750-af469f2f9be5"],
    ["photo-035", "NYC skyline", "photo-1496442226666-8d4d0e62e6e9"],
    ["photo-036", "Soft studio", "photo-1497366216548-37526070297c"],
    ["photo-037", "Neon street", "photo-1498036882173-b41c28a8ba34"],
    ["photo-038", "Lavender fields", "photo-1499002238440-d264edd596ec"],
    ["photo-039", "Golden wheat", "photo-1500382017468-9049fed747ef"],
    ["photo-040", "Countryside", "photo-1500530855697-b586d89ba3ee"],
    ["photo-041", "Sailboat calm", "photo-1500534314209-a25ddb2bd429"],
    ["photo-042", "Kayak lake", "photo-1501785888041-af3ef285b470"],
    ["photo-043", "Open plains", "photo-1501854140801-50d01698950b"],
    ["photo-044", "Tree canopy", "photo-1502082553048-f009c37129b9"],
    ["photo-045", "Paris dawn", "photo-1502602898657-3e91760cbb34"],
    ["photo-046", "Spring blooms", "photo-1504198458649-3128b932f49e"],
    ["photo-047", "Waterfall veil", "photo-1504893524553-b855bce32c67"],
    ["photo-048", "Wave crash", "photo-1505118380757-91f5f5632de0"],
    ["photo-049", "Ocean cliff", "photo-1505142468610-359e7d316be0"],
    ["photo-050", "Turquoise coast", "photo-1505144808419-1957a94ca61e"],
    ["photo-051", "Swiss alps", "photo-1505765050516-f72dcac9c60e"],
    ["photo-052", "Vineyard hills", "photo-1506377247377-2a5b3b417ebb"],
    ["photo-053", "Yosemite valley", "photo-1506744038136-46273834b3fb"],
    ["photo-054", "Beach waves", "photo-1506905925346-21bda4d32df4"],
    ["photo-055", "Great Wall", "photo-1507525428034-b723cf961d3e"],
    ["photo-056", "Desert night", "photo-1508804185872-d7badad00f7d"],
    ["photo-057", "Red rocks", "photo-1509316785289-025f5b846b35"],
    ["photo-058", "Green woods", "photo-1509316975850-ff9c5deb0cd9"],
    ["photo-059", "Dubai lights", "photo-1511497584788-876760111969"],
    ["photo-060", "London fog", "photo-1512453979798-5ea266f8880c"],
    ["photo-061", "Forest canopy", "photo-1513635269975-59663e0ac1ad"],
    ["photo-062", "Safari plain", "photo-1513836279014-a89f7a76ae86"],
    ["photo-063", "Bird flight", "photo-1516026672322-bc52d61a55d5"],
    ["photo-064", "Sunlit leaves", "photo-1516426122078-c23e76319801"],
    ["photo-065", "Ocean horizon", "photo-1517021897933-0e0319cfbc28"],
    ["photo-066", "City night", "photo-1518495973542-4542c06a5843"],
    ["photo-067", "Alpine glow", "photo-1518837695005-2083093ee35b"],
    ["photo-068", "Cherry blossoms", "photo-1519501025264-65ba15a82390"],
    ["photo-069", "Venice canals", "photo-1519681393784-d120267933ba"],
    ["photo-070", "Storm light", "photo-1522383225653-ed111181a951"],
    ["photo-071", "Northern lights", "photo-1523906834658-6e24ef2386f9"],
    ["photo-072", "Hong Kong harbor", "photo-1527482797697-8795b05a13fe"],
    ["photo-073", "Bali temple", "photo-1531366936337-7c912a4589a7"],
    ["photo-074", "Tokyo rain", "photo-1536599018102-9f803c140fc1"],
    ["photo-075", "Coral garden", "photo-1537996194471-e657df975ab4"],
    ["photo-076", "Trail dust", "photo-1540959733332-eab4deabeeaf"],
    ["photo-077", "Underwater light", "photo-1544551763-46a013bb70d5"],
    ["photo-078", "Tea hills", "photo-1551632811-561732d1e306"],
    ["photo-079", "Elephant trail", "photo-1559827260-dc66d52bef19"],
    ["photo-080", "Machu Picchu", "photo-1563911302283-d2bc129e7570"],
    ["photo-081", "Santorini", "photo-1564760055775-d63b17a55c44"],
    ["photo-082", "Desert canyon", "photo-1587595431973-160d0d94add1"],
    ["photo-083", "Ocean cliffs", "photo-1613395877344-13d4a8e0d49e"],
    ["photo-084", "Blue lagoon", "photo-1682687220063-4742bd7fd538"],
    ["photo-085", "Cliffside view", "photo-1682687220742-aba13b6e50ba"],
  ];
  const FALLBACK = "#1a2332";
  const seenId = new Set();
  const seenPath = new Set();
  const entries = [];
  for (const [id, name, path] of PHOTOS) {
    if (seenId.has(id) || seenPath.has(path)) continue;
    seenId.add(id);
    seenPath.add(path);
    const url = U(path);
    entries.push({
      id,
      name,
      css: `url("${url}")`,
      size: "cover",
      repeat: "no-repeat",
      position: "center center",
      photo: true,
      photoUrl: url,
      fallback: FALLBACK,
    });
  }

  function install() {
    if (!window.MySpaceWallpapers?.list) {
      setTimeout(install, 20);
      return;
    }
    const list = window.MySpaceWallpapers.list;
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].photo || String(list[i].id || "").startsWith("picsum-")) {
        list.splice(i, 1);
      }
    }
    const existing = new Set(list.map((w) => w.id));
    for (const entry of entries) {
      if (!existing.has(entry.id)) list.push(entry);
    }
  }

  window.MySpaceWallpaperPhotos = {
    ids: () => entries.map((e) => e.id),
    defaultPlaylist: () => entries.map((e) => e.id),
    count: () => entries.length,
  };
  install();
})();