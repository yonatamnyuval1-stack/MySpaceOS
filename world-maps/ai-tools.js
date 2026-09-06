(() => {
  const MAX_TOOL_ROUNDS = 6;

  const SYSTEM_INSTRUCTION = `You are Gemini inside the World Maps desktop app.
You help the user explore the map, manage markers (notes), and plan travel routes.

You have tools:
- list_markers: see all saved markers
- add_marker: create a marker (use query for places/addresses when coords unknown)
- update_marker: change a marker title/category/position
- delete_marker: remove a marker by id or title
- fly_to_marker: fly the map camera to an existing marker
- move_map: fly the map to a place or coordinates (use this to "show" a location)
- list_routes: see planned dashed routes on the map
- add_route: draw a dashed travel route with a vehicle icon (bus/car/plane/ship) and duration text like "1h 24m"
- delete_route: remove a planned route

Rules:
- Prefer tools over guessing coordinates.
- For "show me X" / "take me to Y" use move_map (and add_marker only if the user asked to save/mark it).
- For travel plans / itineraries between places, use add_route (mode + duration + waypoints).
- Dashed routes are temporary: they auto-remove from the map after exactly 2 minutes.
- Route modes: bus, car, plane, ship. Pick the mode that matches the transport (flight→plane, ferry→ship).
- Duration format examples: "1h 24m", "45m", "2h". Always pass duration when the user mentions travel time.
- Categories for markers: trail, nature, hotel, beach, attraction, restaurant. Default restaurant for food, attraction otherwise.
- Reply briefly in the user's language (Hebrew or English).
- After tools run, give a short confirmation of what you did.`;

  const TOOLS = [
    {
      functionDeclarations: [
        {
          name: "list_markers",
          description: "List all map markers the user has saved (id, title, category, coords, country).",
          parameters: { type: "OBJECT", properties: {} },
        },
        {
          name: "add_marker",
          description:
            "Add a marker on the map. Provide query OR lat+lng. Optionally fly the map to it.",
          parameters: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING", description: "Marker title" },
              category: {
                type: "STRING",
                description: "One of: trail, nature, hotel, beach, attraction, restaurant",
              },
              query: { type: "STRING", description: "Place or address to geocode" },
              lat: { type: "NUMBER" },
              lng: { type: "NUMBER" },
              fly_to: { type: "BOOLEAN", description: "Also move the map to the new marker (default true)" },
            },
            required: ["title"],
          },
        },
        {
          name: "update_marker",
          description: "Update an existing marker: title, category, and/or position.",
          parameters: {
            type: "OBJECT",
            properties: {
              id: { type: "STRING", description: "Exact marker id from list_markers" },
              title: { type: "STRING", description: "Current marker title to find if id unknown" },
              new_title: { type: "STRING", description: "New title" },
              category: {
                type: "STRING",
                description: "New category: trail, nature, hotel, beach, attraction, restaurant",
              },
              query: { type: "STRING", description: "Optional new place to move the marker to" },
              lat: { type: "NUMBER", description: "Optional new latitude" },
              lng: { type: "NUMBER", description: "Optional new longitude" },
              fly_to: { type: "BOOLEAN", description: "Fly map to the marker after update (default true)" },
            },
          },
        },
        {
          name: "delete_marker",
          description: "Delete a saved marker by id, or by title (partial match ok).",
          parameters: {
            type: "OBJECT",
            properties: {
              id: { type: "STRING", description: "Exact marker id from list_markers" },
              title: { type: "STRING", description: "Marker title to match if id unknown" },
            },
          },
        },
        {
          name: "fly_to_marker",
          description: "Fly the map camera to an existing saved marker by id or title.",
          parameters: {
            type: "OBJECT",
            properties: {
              id: { type: "STRING", description: "Exact marker id" },
              title: { type: "STRING", description: "Marker title (partial match ok)" },
              zoom: { type: "NUMBER", description: "Optional zoom (default ~13)" },
            },
          },
        },
        {
          name: "move_map",
          description:
            "Move/fly the map camera to a place or coordinates. Use for requests like show/find a place.",
          parameters: {
            type: "OBJECT",
            properties: {
              query: { type: "STRING", description: "Place search query" },
              lat: { type: "NUMBER" },
              lng: { type: "NUMBER" },
              zoom: { type: "NUMBER", description: "Optional zoom level (about 5 country, 11 city, 14 street)" },
            },
          },
        },
        {
          name: "list_routes",
          description: "List planned dashed travel routes on the map (id, mode, duration, waypoints).",
          parameters: { type: "OBJECT", properties: {} },
        },
        {
          name: "add_route",
          description:
            "Draw a temporary dashed route on the map between places, with a vehicle icon and duration text. Routes auto-remove after exactly 2 minutes.",
          parameters: {
            type: "OBJECT",
            properties: {
              mode: {
                type: "STRING",
                description: "Transport icon: bus | car | plane | ship",
              },
              duration: {
                type: "STRING",
                description: "Travel time label shown on the map, e.g. '1h 24m', '45m', '2h'",
              },
              label: { type: "STRING", description: "Optional route title" },
              from: {
                type: "STRING",
                description: "Start place name/address (geocoded). Use with 'to' for a simple 2-stop route.",
              },
              to: { type: "STRING", description: "End place name/address (geocoded)" },
              waypoints: {
                type: "ARRAY",
                description:
                  "Ordered stops. Each item is a place query string, OR {query}, OR {lat,lng,name?}. Prefer this for 3+ stops.",
                items: {
                  type: "STRING",
                },
              },
              fly_to: {
                type: "BOOLEAN",
                description: "Fit the map to the route after drawing (default true)",
              },
            },
            required: ["mode"],
          },
        },
        {
          name: "delete_route",
          description: "Delete a planned route by id, label, or duration text.",
          parameters: {
            type: "OBJECT",
            properties: {
              id: { type: "STRING", description: "Exact route id from list_routes" },
              label: { type: "STRING", description: "Route label to match" },
              duration: { type: "STRING", description: "Duration text to match if needed" },
            },
          },
        },
      ],
    },
  ];

  function api() {
    return window.WorldMapsMapApi || null;
  }

  function lang() {
    return window.WMi18n?.lang?.() || "en";
  }

  function guessZoomFromItem(item) {
    const type = String(item?.type || item?.addresstype || item?.class || "").toLowerCase();
    if (type.includes("country") || type === "administrative") return 5;
    if (type.includes("state") || type.includes("region")) return 7;
    if (type.includes("city") || type.includes("town") || type.includes("village")) return 11;
    if (type.includes("road") || type.includes("house")) return 15;
    return 12;
  }

  async function resolvePlace({ query, lat, lng, zoom }) {
    if (typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng)) {
      return {
        lat,
        lng,
        zoom: typeof zoom === "number" ? zoom : 12,
        label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        address: "",
        countryCode: "",
        countryName: "",
      };
    }

    const q = String(query || "").trim();
    if (!q) throw new Error("Provide query or lat/lng");

    const results = await window.worldMaps.geocode(q, lang());
    if (!Array.isArray(results) || !results.length) {
      throw new Error(`No places found for "${q}"`);
    }

    const item = results[0];
    const resolvedLat = parseFloat(item.lat);
    const resolvedLng = parseFloat(item.lon);
    if (!Number.isFinite(resolvedLat) || !Number.isFinite(resolvedLng)) {
      throw new Error("Invalid geocode result");
    }

    const addr = item.address || {};
    return {
      lat: resolvedLat,
      lng: resolvedLng,
      zoom: typeof zoom === "number" ? zoom : guessZoomFromItem(item),
      label: item.display_name || q,
      address: item.display_name || "",
      countryCode: String(addr.country_code || "").toUpperCase(),
      countryName: addr.country || "",
      candidates: results.slice(0, 3).map((r) => r.display_name),
    };
  }

  function num(v) {
    if (typeof v === "number") return v;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : NaN;
  }

  async function resolveWaypoint(raw) {
    if (raw == null) throw new Error("Empty waypoint");
    if (typeof raw === "string") {
      const place = await resolvePlace({ query: raw });
      return { lat: place.lat, lng: place.lng, name: place.label };
    }
    if (typeof raw === "object") {
      const lat = num(raw.lat);
      const lng = num(raw.lng ?? raw.lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng, name: String(raw.name || raw.label || "").trim() };
      }
      const q = raw.query || raw.q || raw.place || raw.name || raw.address;
      if (q) {
        const place = await resolvePlace({ query: q });
        return { lat: place.lat, lng: place.lng, name: place.label };
      }
    }
    throw new Error(`Could not resolve waypoint: ${JSON.stringify(raw)}`);
  }

  async function executeTool(name, args) {
    const mapApi = api();
    if (!mapApi) return { ok: false, error: "Map API not ready" };
    const a = args && typeof args === "object" ? args : {};

    try {
      if (name === "list_markers") {
        const list = mapApi.listNotes();
        return { ok: true, count: list.length, markers: list };
      }

      if (name === "add_marker") {
        const title = String(a.title || "").trim();
        if (!title) return { ok: false, error: "title is required" };
        const category = String(a.category || "attraction").toLowerCase();
        const place = await resolvePlace({
          query: a.query,
          lat: num(a.lat),
          lng: num(a.lng),
        });
        const note = await mapApi.addNote(category, title, place.lng, place.lat, {
          address: place.address,
          countryCode: place.countryCode || undefined,
          countryName: place.countryName || undefined,
        });
        const shouldFly = a.fly_to !== false;
        if (shouldFly) {
          mapApi.flyTo(note.lng, note.lat, Math.max(place.zoom, 13), note.title);
          mapApi.showNotePopup?.(note);
        }
        return {
          ok: true,
          marker: {
            id: note.id,
            title: note.title,
            category: note.category,
            lat: note.lat,
            lng: note.lng,
            countryName: note.countryName || "",
            address: note.address || "",
          },
          flewTo: shouldFly,
        };
      }

      if (name === "update_marker") {
        const id = String(a.id || "").trim();
        const title = String(a.title || "").trim();
        let target = null;
        if (id) target = mapApi.getNoteById(id);
        if (!target && title) target = mapApi.findNoteByTitle(title);
        if (!target) return { ok: false, error: "Marker not found" };

        const patch = {};
        if (a.new_title != null || a.newTitle != null) {
          patch.title = a.new_title ?? a.newTitle;
        }
        if (a.category != null) patch.category = a.category;

        const hasCoords = Number.isFinite(num(a.lat)) && Number.isFinite(num(a.lng));
        if (hasCoords) {
          patch.lat = num(a.lat);
          patch.lng = num(a.lng);
        } else if (a.query) {
          const place = await resolvePlace({ query: a.query });
          patch.lat = place.lat;
          patch.lng = place.lng;
          patch.address = place.address;
        }

        if (!Object.keys(patch).length) {
          return { ok: false, error: "Provide new_title, category, query, and/or lat+lng" };
        }

        const note = await mapApi.updateNote(target.id, patch);
        if (!note) return { ok: false, error: "Update failed" };
        const shouldFly = a.fly_to !== false;
        if (shouldFly) {
          mapApi.flyTo(note.lng, note.lat, 13, note.title);
          mapApi.showNotePopup?.(note);
        }
        return {
          ok: true,
          marker: {
            id: note.id,
            title: note.title,
            category: note.category,
            lat: note.lat,
            lng: note.lng,
            address: note.address || "",
          },
          flewTo: shouldFly,
        };
      }

      if (name === "delete_marker") {
        const id = String(a.id || "").trim();
        const title = String(a.title || "").trim();
        let target = null;
        if (id) target = mapApi.getNoteById(id);
        if (!target && title) target = mapApi.findNoteByTitle(title);
        if (!target) return { ok: false, error: "Marker not found" };
        await mapApi.deleteNote(target.id);
        return { ok: true, deleted: { id: target.id, title: target.title } };
      }

      if (name === "fly_to_marker") {
        const id = String(a.id || "").trim();
        const title = String(a.title || "").trim();
        let target = null;
        if (id) target = mapApi.getNoteById(id);
        if (!target && title) target = mapApi.findNoteByTitle(title);
        if (!target) return { ok: false, error: "Marker not found" };
        const zoom = Number.isFinite(num(a.zoom)) ? num(a.zoom) : 13;
        mapApi.flyTo(target.lng, target.lat, zoom, target.title);
        mapApi.showNotePopup?.(target);
        return {
          ok: true,
          marker: { id: target.id, title: target.title, lat: target.lat, lng: target.lng },
          zoom,
        };
      }

      if (name === "move_map") {
        const place = await resolvePlace({
          query: a.query,
          lat: num(a.lat),
          lng: num(a.lng),
          zoom: num(a.zoom),
        });
        mapApi.flyTo(place.lng, place.lat, place.zoom, place.label);
        return {
          ok: true,
          center: { lat: place.lat, lng: place.lng },
          zoom: place.zoom,
          label: place.label,
          alternatives: place.candidates || [],
        };
      }

      if (name === "list_routes") {
        const list = mapApi.listRoutes?.() || [];
        return { ok: true, count: list.length, routes: list };
      }

      if (name === "add_route") {
        const mode = String(a.mode || a.vehicle || a.transport || "car").toLowerCase();
        const duration = String(a.duration || a.time || a.eta || "").trim();
        const label = String(a.label || a.title || a.name || "").trim();

        const waypointInputs = [];
        if (Array.isArray(a.waypoints) && a.waypoints.length) {
          waypointInputs.push(...a.waypoints);
        } else if (a.from && a.to) {
          waypointInputs.push(a.from, a.to);
          if (Array.isArray(a.via)) waypointInputs.splice(1, 0, ...a.via);
          else if (a.via) waypointInputs.splice(1, 0, a.via);
        } else if (Array.isArray(a.stops) && a.stops.length) {
          waypointInputs.push(...a.stops);
        }

        if (waypointInputs.length < 2) {
          return {
            ok: false,
            error: "Provide from+to, or waypoints/stops with at least 2 places",
          };
        }

        const waypoints = [];
        for (const raw of waypointInputs) {
          waypoints.push(await resolveWaypoint(raw));
        }

        const route = await mapApi.addRoute({
          mode,
          duration,
          label,
          waypoints,
        });

        const shouldFly = a.fly_to !== false;
        if (shouldFly) mapApi.flyToRoute?.(route);

        return {
          ok: true,
          route: {
            id: route.id,
            mode: route.mode,
            duration: route.duration,
            label: route.label,
            waypoints: route.waypoints,
          },
          flewTo: shouldFly,
        };
      }

      if (name === "delete_route") {
        const id = String(a.id || "").trim();
        const label = String(a.label || a.title || "").trim();
        const duration = String(a.duration || "").trim();
        let target = null;
        if (id) target = mapApi.getRouteById?.(id) || null;
        if (!target && label) target = mapApi.findRoute?.(label);
        if (!target && duration) target = mapApi.findRoute?.(duration);
        if (!target) return { ok: false, error: "Route not found" };
        await mapApi.deleteRoute(target.id);
        return {
          ok: true,
          deleted: {
            id: target.id,
            mode: target.mode,
            duration: target.duration || "",
            label: target.label || "",
          },
        };
      }

      return { ok: false, error: `Unknown tool: ${name}` };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  }

  function extractText(parts) {
    if (!Array.isArray(parts)) return "";
    return parts
      .map((p) => (typeof p?.text === "string" ? p.text : ""))
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  function extractFunctionCalls(parts) {
    if (!Array.isArray(parts)) return [];
    return parts
      .filter((p) => p?.functionCall?.name)
      .map((p) => ({
        id: p.functionCall.id || p.id,
        name: p.functionCall.name,
        args: p.functionCall.args || {},
        thoughtSignature: p.thoughtSignature,
      }));
  }

  function historyToContents(messages) {
    const contents = [];
    for (const msg of messages || []) {
      const role = msg.role === "assistant" || msg.role === "model" ? "model" : "user";
      const text = String(msg.content || msg.text || "").trim();
      if (!text) continue;
      contents.push({ role, parts: [{ text }] });
    }
    return contents;
  }

  async function runAgent(messages) {
    if (!window.worldMaps?.geminiGenerate) {
      return { ok: false, error: "Gemini bridge unavailable" };
    }

    const contents = historyToContents(messages);
    const toolsUsed = [];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const res = await window.worldMaps.geminiGenerate({
        systemInstruction: SYSTEM_INSTRUCTION,
        contents,
        tools: TOOLS,
      });

      if (!res?.ok) {
        return { ok: false, error: res?.error || "Gemini request failed", toolsUsed };
      }

      const parts = res.parts || res.candidate?.content?.parts || [];
      const text =
        extractText(parts) ||
        String(res.text || "").trim() ||
        extractText(res.candidate?.content?.parts || []);
      const calls = extractFunctionCalls(parts);
      const finishReason = res.finishReason || res.candidate?.finishReason || "";

      if (!calls.length) {
        if (text) return { ok: true, content: text, model: res.model, toolsUsed };
        const reason = finishReason || "empty";
        return {
          ok: false,
          error: `No response (${reason})`,
          toolsUsed,
          debug: {
            partKinds: parts.map((p) => Object.keys(p || {})),
            finishReason: reason,
          },
        };
      }

      contents.push({ role: "model", parts });

      const responseParts = [];
      for (const call of calls) {
        const result = await executeTool(call.name, call.args);
        toolsUsed.push({ name: call.name, args: call.args, result });
        const fr = { name: call.name, response: result };
        if (call.id) fr.id = call.id;
        responseParts.push({ functionResponse: fr });
      }
      contents.push({ role: "user", parts: responseParts });
    }

    return {
      ok: false,
      error: "Too many tool rounds.",
      toolsUsed,
    };
  }

  window.WorldMapsAiAgent = { runAgent, TOOLS, executeTool };
})();