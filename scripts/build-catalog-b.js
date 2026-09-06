const fs = require("fs");
const path = require("path");

const lines = `
abu_simbel|Abu Simbel|EGY|Aswan|31.6258|22.3372|landmark|Abu Simbel
valley_kings|Valley of the Kings|EGY|Luxor|32.6014|25.7402|landmark|Valley of the Kings
karnak|Karnak Temple|EGY|Luxor|32.6574|25.7188|landmark|Karnak
table_mountain|Table Mountain|ZAF|Cape Town|18.4098|-33.9628|nature|Table Mountain
kruger|Kruger National Park|ZAF|Mpumalanga|31.4849|-24.0115|nature|Kruger National Park
serengeti|Serengeti|TZA|Arusha|34.8333|-2.3333|nature|Serengeti National Park
kilimanjaro|Mount Kilimanjaro|TZA|Moshi|37.3556|-3.0674|nature|Mount Kilimanjaro
lalibela|Rock-Hewn Churches|ETH|Lalibela|39.0473|12.0319|landmark|Lalibela
petra|Petra|JOR|Wadi Musa|35.4444|30.3285|landmark|Petra
wadi_rum|Wadi Rum|JOR|Aqaba|35.4969|29.532|nature|Wadi Rum
persepolis|Persepolis|IRN|Shiraz|52.8914|29.9355|landmark|Persepolis
samarkand|Registan|UZB|Samarkand|66.9721|39.6542|landmark|Registan
taj_mahal|Taj Mahal|IND|Agra|78.0421|27.1751|landmark|Taj Mahal
varanasi_ghats|Varanasi Ghats|IND|Varanasi|83.0104|25.3176|street|Varanasi
hampi|Hampi|IND|Hampi|76.4605|15.335|landmark|Hampi
ellora|Ellora Caves|IND|Aurangabad|75.179|20.0264|landmark|Ellora Caves
sigiriya|Sigiriya|LKA|Sigiriya|80.7603|7.957|landmark|Sigiriya
halong|Ha Long Bay|VNM|Ha Long|107.1839|20.9101|nature|Ha Long Bay
hoi_an|Hoi An Ancient Town|VNM|Hoi An|108.338|15.8801|street|Hoi An
angkor|Angkor Wat|KHM|Siem Reap|103.8669|13.4125|landmark|Angkor Wat
bagan|Bagan|MMR|Bagan|94.8715|21.1717|landmark|Bagan
borobudur|Borobudur|IDN|Magelang|110.2039|-7.6079|landmark|Borobudur
komodo|Komodo National Park|IDN|Flores|119.4894|-8.5569|nature|Komodo National Park
bali_ubud|Ubud|IDN|Bali|115.2654|-8.5069|street|Ubud
petronas_towers|Petronas Towers|MYS|Kuala Lumpur|101.7116|3.1579|landmark|Petronas Towers
palawan|Palawan|PHL|Palawan|118.7384|9.8349|nature|Palawan
banaue|Banaue Rice Terraces|PHL|Ifugao|121.0563|16.9176|landmark|Banaue Rice Terraces
gyeongbok|Gyeongbokgung|KOR|Seoul|126.977|37.5796|landmark|Gyeongbokgung
fushimi|Fushimi Inari|JPN|Kyoto|135.7727|34.9671|landmark|Fushimi Inari-taisha
hiroshima_peace|Peace Memorial|JPN|Hiroshima|132.4543|34.3955|landmark|Hiroshima Peace Memorial
terracotta|Terracotta Army|CHN|Xi'an|109.2734|34.3848|landmark|Terracotta Army
potala|Potala Palace|CHN|Lhasa|91.1171|29.6558|landmark|Potala Palace
summer_palace|Summer Palace|CHN|Beijing|116.2755|39.9999|landmark|Summer Palace
bund|The Bund|CHN|Shanghai|121.4908|31.2397|street|The Bund
west_lake|West Lake|CHN|Hangzhou|120.1486|30.242|nature|West Lake
huangshan|Huangshan|CHN|Anhui|118.167|30.133|nature|Huangshan
sydney_opera|Sydney Opera House|AUS|Sydney|151.2153|-33.8568|landmark|Sydney Opera House
uluru|Uluru|AUS|Northern Territory|131.0369|-25.3444|landmark|Uluru
great_barrier_reef|Great Barrier Reef|AUS|Queensland|145.7781|-16.9186|nature|Great Barrier Reef
milford|Milford Sound|NZL|Fiordland|167.8976|-44.6414|nature|Milford Sound
iguazu|Iguazu Falls|ARG|Misiones|-54.4367|-25.6953|nature|Iguazu Falls
salar_uyuni|Salar de Uyuni|BOL|Uyuni|-67.4891|-20.1338|nature|Salar de Uyuni
nazca|Nazca Lines|PER|Nazca|-75.1103|-14.739|landmark|Nazca Lines
galapagos|Galápagos|ECU|Galápagos|-90.3515|-0.7393|nature|Galápagos Islands
tikal|Tikal|GTM|Petén|-89.6237|17.222|landmark|Tikal
teotihuacan|Teotihuacan|MEX|Mexico State|-98.8438|19.6925|landmark|Teotihuacan
tulum|Tulum|MEX|Quintana Roo|-87.4633|20.2114|landmark|Tulum
moraine_lake|Moraine Lake|CAN|Banff|-116.182|51.3277|nature|Moraine Lake
yellowstone|Yellowstone|USA|Wyoming|-110.5885|44.428|nature|Yellowstone National Park
mount_rushmore|Mount Rushmore|USA|South Dakota|-103.459|43.8791|landmark|Mount Rushmore
french_quarter|French Quarter|USA|New Orleans|-90.064|29.9584|street|French Quarter
blue_lagoon|Blue Lagoon|ISL|Grindavik|-22.4495|63.8804|nature|Blue Lagoon (geothermal spa)
lofoten|Lofoten|NOR|Lofoten|13.6|68.2|nature|Lofoten
preikestolen|Preikestolen|NOR|Stavanger|6.0941|58.9864|nature|Preikestolen
tivoli|Tivoli Gardens|DNK|Copenhagen|12.5683|55.6737|landmark|Tivoli Gardens
wawel|Wawel Castle|POL|Kraków|19.9364|50.0547|landmark|Wawel Castle
auschwitz|Auschwitz Memorial|POL|Oświęcim|19.2036|50.0344|landmark|Auschwitz-Birkenau Memorial and Museum
bran|Bran Castle|ROU|Bran|25.367|45.515|landmark|Bran Castle
plitvice|Plitvice Lakes|HRV|Plitvice|15.617|44.8654|nature|Plitvice Lakes National Park
dubrovnik_walls|Dubrovnik Walls|HRV|Dubrovnik|18.1105|42.6403|landmark|Walls of Dubrovnik
hallstatt|Hallstatt|AUT|Hallstatt|13.6493|47.5622|street|Hallstatt
neuschwanstein|Neuschwanstein|DEU|Bavaria|10.7498|47.5576|landmark|Neuschwanstein Castle
brandenburg|Brandenburg Gate|DEU|Berlin|13.3777|52.5163|landmark|Brandenburg Gate
mont_saint|Mont-Saint-Michel|FRA|Normandy|-1.5115|48.636|landmark|Mont-Saint-Michel
versailles|Palace of Versailles|FRA|Versailles|2.1204|48.8049|landmark|Palace of Versailles
alhambra|Alhambra|ESP|Granada|-3.5889|37.176|landmark|Alhambra
sagrada|Sagrada Família|ESP|Barcelona|2.1744|41.4036|landmark|Sagrada Família
pompeii|Pompeii|ITA|Naples|14.489|40.7489|landmark|Pompeii
cinque_terre|Cinque Terre|ITA|La Spezia|9.716|44.127|nature|Cinque Terre
amalfi|Amalfi Coast|ITA|Amalfi|14.6026|40.634|nature|Amalfi Coast
pisa_tower|Leaning Tower of Pisa|ITA|Pisa|10.3966|43.723|landmark|Leaning Tower of Pisa
meteora|Meteora|GRC|Kalabaka|21.6253|39.7211|landmark|Meteora
santorini_oia|Oia Santorini|GRC|Santorini|25.3753|36.4618|street|Oia, Santorini
cappadocia|Cappadocia|TUR|Göreme|34.8283|38.6431|nature|Cappadocia
ephesus|Ephesus|TUR|Selçuk|27.3638|37.9397|landmark|Ephesus
pamukkale|Pamukkale|TUR|Denizli|29.1203|37.9138|nature|Pamukkale
sheikh_zayed|Sheikh Zayed Mosque|ARE|Abu Dhabi|54.4747|24.4128|landmark|Sheikh Zayed Grand Mosque
burj_al_arab|Burj Al Arab|ARE|Dubai|55.1853|25.1412|landmark|Burj Al Arab
dubai_marina|Dubai Marina|ARE|Dubai|55.1393|25.0805|street|Dubai Marina
matera|Matera|ITA|Matera|16.6048|40.6663|street|Matera
dolomites|Dolomites|ITA|Trentino|11.9|46.4|nature|Dolomites
lake_como|Lake Como|ITA|Como|9.257|46.016|nature|Lake Como
rhine_valley|Rhine Gorge|DEU|Koblenz|7.674|50.364|nature|Rhine Gorge
cologne_cathedral|Cologne Cathedral|DEU|Cologne|6.9583|50.9413|landmark|Cologne Cathedral
nice_prom|Promenade des Anglais|FRA|Nice|7.2665|43.6951|street|Promenade des Anglais
park_guell|Park Güell|ESP|Barcelona|2.1527|41.4145|landmark|Park Güell
sintra_pena|Pena Palace|PRT|Sintra|-9.3907|38.7876|landmark|Pena Palace
douro|Douro Valley|PRT|Porto|-7.8|41.15|nature|Douro (wine region)
tallinn_old|Tallinn Old Town|EST|Tallinn|24.7536|59.437|street|Tallinn
riga_old|Riga Old Town|LVA|Riga|24.1052|56.9496|street|Riga
vilnius_old|Vilnius Old Town|LTU|Vilnius|25.2797|54.6872|street|Vilnius
mostar|Stari Most|BIH|Mostar|17.8157|43.3373|landmark|Stari Most
budapest_parliament|Hungarian Parliament|HUN|Budapest|19.0456|47.507|landmark|Hungarian Parliament Building
szechenyi|Széchenyi Baths|HUN|Budapest|19.0814|47.5189|landmark|Széchenyi thermal bath
okavango|Okavango Delta|BWA|Maun|23.1641|-19.2827|nature|Okavango Delta
victoria_falls_zim|Victoria Falls|ZWE|Victoria Falls|25.8546|-17.9243|nature|Victoria Falls
zanzibar_stone|Stone Town|TZA|Zanzibar|39.1942|-6.1639|street|Stone Town, Zanzibar
ngorongoro|Ngorongoro Crater|TZA|Arusha|35.5833|-3.1667|nature|Ngorongoro Conservation Area
jaipur_hawa|Hawa Mahal|IND|Jaipur|75.8267|26.9239|landmark|Hawa Mahal
kerala_backwaters|Kerala Backwaters|IND|Alleppey|76.3388|9.4981|nature|Kerala backwaters
khajuraho|Khajuraho|IND|Khajuraho|79.9229|24.8532|landmark|Khajuraho Group of Monuments
bodh_gaya|Mahabodhi Temple|IND|Bodh Gaya|84.9919|24.696|landmark|Mahabodhi Temple
pokhara|Phewa Lake|NPL|Pokhara|83.9496|28.2096|nature|Phewa Lake
tiger_nest|Tiger's Nest|BTN|Paro|89.3639|27.492|landmark|Paro Taktsang
luang_prabang|Luang Prabang|LAO|Luang Prabang|102.135|19.886|street|Luang Prabang
inle_lake|Inle Lake|MMR|Shan|96.9109|20.5863|nature|Inle Lake
bromo|Mount Bromo|IDN|East Java|112.9505|-7.9425|nature|Mount Bromo
raja_ampat|Raja Ampat|IDN|West Papua|130.833|-0.5|nature|Raja Ampat
tanah_lot|Tanah Lot|IDN|Bali|115.088|-8.6211|landmark|Tanah Lot
george_town|George Town|MYS|Penang|100.3354|5.4141|street|George Town, Penang
kinabalu|Mount Kinabalu|MYS|Sabah|116.558|6.075|nature|Mount Kinabalu
boracay|Boracay|PHL|Aklan|121.9242|11.9674|nature|Boracay
intramuros|Intramuros|PHL|Manila|120.9747|14.5906|street|Intramuros
jeju|Jeju Island|KOR|Jeju|126.5312|33.4996|nature|Jeju Island
nara_deer|Nara Park|JPN|Nara|135.843|34.6851|nature|Nara Park
arashiyama|Arashiyama|JPN|Kyoto|135.6686|35.0094|nature|Arashiyama
shuri|Shuri Castle|JPN|Okinawa|127.716|26.217|landmark|Shurijo
zhangjiajie|Zhangjiajie|CHN|Hunan|110.479|29.117|nature|Zhangjiajie National Forest Park
jiuzhaigou|Jiuzhaigou|CHN|Sichuan|103.918|33.26|nature|Jiuzhaigou Valley
lijiang_old|Old Town Lijiang|CHN|Lijiang|100.234|26.872|street|Old Town of Lijiang
tiananmen|Tiananmen Square|CHN|Beijing|116.3975|39.9035|street|Tiananmen Square
macau_ruins|Ruins of St. Paul's|MAC|Macau|113.5407|22.1977|landmark|Ruins of Saint Paul's
blue_mountains|Blue Mountains|AUS|Katoomba|150.3115|-33.7121|nature|Blue Mountains (New South Wales)
great_ocean_road|Great Ocean Road|AUS|Victoria|143.65|-38.75|nature|Great Ocean Road
hobbiton|Hobbiton|NZL|Matamata|175.6822|-37.872|landmark|Hobbiton Movie Set
rotorua|Rotorua|NZL|Rotorua|176.2452|-38.1368|nature|Rotorua
atacama|Atacama Desert|CHL|San Pedro|-68.2017|-22.9083|nature|Atacama Desert
perito_moreno|Perito Moreno Glacier|ARG|El Calafate|-73.0277|-50.4966|nature|Perito Moreno Glacier
lake_titicaca|Lake Titicaca|PER|Puno|-69.3333|-15.925|nature|Lake Titicaca
cusco_plaza|Cusco Plaza|PER|Cusco|-71.9675|-13.5164|street|Cusco
cartagena_walled|Walled City Cartagena|COL|Cartagena|-75.5511|10.3997|street|Cartagena, Colombia
panama_canal|Panama Canal|PAN|Panama|-79.92|9.08|landmark|Panama Canal
havana_old|Old Havana|CUB|Havana|-82.3509|23.1367|street|Old Havana
palenque|Palenque|MEX|Chiapas|-92.0463|17.4833|landmark|Palenque
copper_canyon|Copper Canyon|MEX|Chihuahua|-107.85|27.5|nature|Copper Canyon
zion|Zion National Park|USA|Utah|-113.0263|37.2982|nature|Zion National Park
monument_valley|Monument Valley|USA|Arizona|-110.0985|36.9983|nature|Monument Valley
alamo|The Alamo|USA|San Antonio|-98.4858|29.426|landmark|The Alamo
national_mall|National Mall|USA|Washington|-77.0365|38.8895|street|National Mall
freedom_trail|Freedom Trail|USA|Boston|-71.057|42.3601|street|Freedom Trail
rocky_mountain|Rocky Mountain NP|USA|Colorado|-105.6836|40.3428|nature|Rocky Mountain National Park
jasper|Jasper National Park|CAN|Alberta|-118.0813|52.8737|nature|Jasper National Park
whistler|Whistler|CAN|BC|-122.9574|50.1163|nature|Whistler, British Columbia
geysir|Geysir|ISL|Haukadalur|-20.3022|64.3104|nature|Geysir
harpa|Harpa|ISL|Reykjavik|-21.9336|64.1505|landmark|Harpa (concert hall)
tromso|Tromsø|NOR|Tromsø|18.9553|69.6492|street|Tromsø
geiranger|Geirangerfjord|NOR|Geiranger|7.205|62.1015|nature|Geirangerfjord
visby|Visby|SWE|Gotland|18.2948|57.6348|street|Visby
suomenlinna|Suomenlinna|FIN|Helsinki|24.9884|60.1458|landmark|Suomenlinna
santa_village|Santa Claus Village|FIN|Rovaniemi|25.6684|66.5436|landmark|Santa Claus Village
wieliczka|Wieliczka Salt Mine|POL|Kraków|20.0627|49.9833|landmark|Wieliczka Salt Mine
sighisoara|Sighișoara|ROU|Sighișoara|24.7925|46.2197|street|Sighișoara
rila|Rila Monastery|BGR|Rila|23.34|42.1339|landmark|Rila Monastery
postojna|Postojna Cave|SVN|Postojna|14.203|45.7815|nature|Postojna Cave
hohensalzburg|Hohensalzburg|AUT|Salzburg|13.0477|47.7984|landmark|Hohensalzburg Fortress
reichstag|Reichstag|DEU|Berlin|13.3761|52.5186|landmark|Reichstag building
chambord|Château de Chambord|FRA|Loire|1.5169|47.6161|landmark|Château de Chambord
provence_lavender|Provence lavender|FRA|Valensole|5.9836|43.8367|nature|Provence
cannes|Cannes|FRA|Cannes|7.0174|43.5528|landmark|Cannes
plaza_espana|Plaza de España Seville|ESP|Seville|-5.9869|37.3772|landmark|Plaza de España, Seville
santiago_cathedral|Santiago Cathedral|ESP|Santiago|-8.5456|42.8805|landmark|Santiago de Compostela Cathedral
fatima|Sanctuary of Fátima|PRT|Fátima|-8.8247|39.6317|landmark|Sanctuary of Fátima
obidos|Óbidos|PRT|Óbidos|-9.1575|39.3606|street|Óbidos
duomo_milan|Milan Cathedral|ITA|Milan|9.1916|45.4641|landmark|Milan Cathedral
delphi|Delphi|GRC|Delphi|22.4995|38.4824|landmark|Delphi
rhodes_old|Rhodes Old Town|GRC|Rhodes|28.2236|36.4446|street|Rhodes (city)
knossos|Knossos|GRC|Heraklion|25.1631|35.298|landmark|Knossos
baalbek|Baalbek|LBN|Baalbek|36.2031|34.0058|landmark|Baalbek
byblos|Byblos|LBN|Jbeil|35.6467|34.123|landmark|Byblos
isfahan_sq|Naqsh-e Jahan Square|IRN|Isfahan|51.6772|32.6577|street|Naqsh-e Jahan Square
bukhara|Historic Bukhara|UZB|Bukhara|64.4281|39.7681|landmark|Bukhara
djenne_mosque|Great Mosque of Djenné|MLI|Djenné|-4.5553|13.9059|landmark|Great Mosque of Djenné
timbuktu|Timbuktu|MLI|Timbuktu|-3.0074|16.7664|landmark|Timbuktu
`.trim();

const rows = lines
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    const p = line.split("|");
    return `  ["${p[0]}", "${p[1]}", "${p[2]}", "${p[3]}", ${p[4]}, ${p[5]}, "${p[6]}", "${p[7] || p[1]}"],`;
  });

const out = `/**
 * Additional curated places — part B
 * Format: [id, name, country, city, lon, lat, type, wikiTitle]
 */
module.exports = [
${rows.join("\n")}
];
`;

fs.writeFileSync(path.join(__dirname, "earth-places-catalog-b.js"), out);
console.log("Wrote", rows.length, "places to earth-places-catalog-b.js");
