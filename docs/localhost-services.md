# Localhost services (intentional)
My Space uses **loopback / localhost** on purpose for several local integrations. This is not a misconfiguration and is expected in both development and packaged installs.
| Service | Default endpoint | Purpose |
| --- | --- | --- |
| **Ollama** (Mind local) | `http://127.0.0.1:11434` | Optional local LLM. Enable in Mind settings when Ollama is installed on this PC. |
| **Model Lab / Model Flow** | `http://127.0.0.1:8080` (`/v1`) | Optional local Lab API for planning/tool flows. Override with `MODEL_FLOW_BASE_URL` if needed. |
| **OS Bridge pair server** | `http://127.0.0.1:17834` (and LAN bind when pairing) | Phone / device pairing. Pairing UI and codes are local to this machine. |
| **Mail OAuth loopback** | `http://127.0.0.1:<ephemeral>` | Google OAuth redirect for desktop Gmail. Listens only on loopback with a random port. |
## Notes for testers / reviewers
- Firewall prompts or “listening on localhost” during OAuth / Bridge / Agent setup are expected when those features are used.
- If Ollama or Lab is not running, Mind / Model Flow / Mind Chat fail fast with a clear “not reachable” / “isn’t running” message (timeouts, no endless Working… spinner) — that does **not** mean the OS is broken. Add a Gemini key in Mind → Setup to chat without Lab.
- Do not expose these ports to the public internet. Prefer loopback; LAN bind for Bridge/Agent is a separate opt-in path (see release checklist Remote Hub / Bridge items).
- Packaged builds still expect these services on the **same PC** as My Space unless you change env / settings.