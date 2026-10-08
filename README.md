# My Space
This is the desktop I wanted on top of Windows: my apps in one place, a shell that actually talks to them, and a space that feels mine.
It is not a website, and it is not trying to replace Windows. It is a personal layer that sits on top and stays on this PC.

## See it without installing

Open the [screenshot walkthrough](docs/demo/index.html) in a browser. No download, just a tour of what it looks like.

## Run it

You need [Node.js](https://nodejs.org) (LTS is fine).

```bat
open.bat
```

Or: `npm install`, then `npm start`.

Use those: do not open `src/index.html` in Chrome. This is a desktop app.

## What’s inside

- **Desktop**: icons, taskbar, virtual desktops, your wallpaper
- **Apps**: notes, chat, maps, stocks, and the rest living under one shell
- **Platform**: Files, Jobs, Themes, Permissions, and friends from the atom menu
- **Shell / Runtime**: type My Space Language on the desktop line, or keep longer programs in Runtime
- **Mind**: the built-in AI. Paste a Gemini key in Mind → Setup
- **Resolve**: when something breaks, the report stays here on your machine (nothing is phoned home)
The full handbook is inside the app: open **Docs**.

## Keys and secrets

Mind asks for a **Gemini** API key. Keep real keys out of git: copy from `config/*.example.json` when you need local config.
Optional local helpers (Ollama, etc.) are noted in [docs/localhost-services.md](docs/localhost-services.md). Missing them is normal; the OS still runs.

## License

Copyright © 2026. A `LICENSE` file may follow: until then, ask before redistributing.