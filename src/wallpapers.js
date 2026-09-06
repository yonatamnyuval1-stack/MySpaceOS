(function () {
  function svgLayer(svg) {
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }

  function dots(color, size = 24, r = 1.4) {
    return svgLayer(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="${color}"/>
      </svg>`
    );
  }

  function grid(color, size = 28) {
    return svgLayer(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <path d="M${size} 0H0M0 0V${size}" stroke="${color}" stroke-width="1" fill="none"/>
      </svg>`
    );
  }

  function diagonal(color, size = 16) {
    return svgLayer(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <path d="M0 ${size}L${size} 0" stroke="${color}" stroke-width="1.5" fill="none"/>
      </svg>`
    );
  }

  function hexes(color, size = 36) {
    return svgLayer(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${(size * 0.866).toFixed(1)}" viewBox="0 0 36 31.2">
        <path d="M18 1.5L33 10v12L18 29.7 3 22V10Z" fill="none" stroke="${color}" stroke-width="1.2"/>
      </svg>`
    );
  }

  function waves(c1, c2) {
    return svgLayer(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320" preserveAspectRatio="none">
        <path fill="${c1}" d="M0,192L60,170.7C120,149,240,107,360,112C480,117,600,171,720,181.3C840,192,960,160,1080,144C1200,128,1320,128,1380,128L1440,128L1440,320L0,320Z"/>
        <path fill="${c2}" d="M0,256L80,240C160,224,320,192,480,181.3C640,171,800,181,960,192C1120,203,1280,213,1360,218.7L1440,224L1440,320L0,320Z" opacity=".85"/>
      </svg>`
    );
  }

  function mountains(c1, c2, c3) {
    return svgLayer(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMax slice">
        <path fill="${c1}" d="M0 600V320L220 180l180 140 160-200 200 180 180-120 260 200v220z"/>
        <path fill="${c2}" d="M0 600V400l180 40 200-160 160 120 220-100 180 80 260 20v200z"/>
        <path fill="${c3}" d="M0 600V480l300-40 200 60 250-80 250 40 200 20v120z"/>
      </svg>`
    );
  }

  function sunHorizon(sky1, sky2, sun, ground) {
    return svgLayer(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${sky1}"/>
            <stop offset="70%" stop-color="${sky2}"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="800" fill="url(#sky)"/>
        <circle cx="900" cy="280" r="90" fill="${sun}" opacity=".95"/>
        <rect y="520" width="1200" height="280" fill="${ground}"/>
      </svg>`
    );
  }

  function blobs(bg, a, b, c) {
    return svgLayer(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
        <rect width="1200" height="800" fill="${bg}"/>
        <circle cx="220" cy="180" r="160" fill="${a}" opacity=".55"/>
        <circle cx="980" cy="220" r="200" fill="${b}" opacity=".45"/>
        <circle cx="640" cy="620" r="240" fill="${c}" opacity=".4"/>
        <circle cx="360" cy="520" r="120" fill="${b}" opacity=".35"/>
      </svg>`
    );
  }

  function chevrons(color, size = 28) {
    return svgLayer(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <path d="M4 10l10 8 10-8M4 4l10 8 10-8" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round"/>
      </svg>`
    );
  }

  function rings(color) {
    return svgLayer(
      `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="18" fill="none" stroke="${color}" stroke-width="1.4"/>
        <circle cx="32" cy="32" r="8" fill="none" stroke="${color}" stroke-width="1.2"/>
      </svg>`
    );
  }

  function triangles(color, size = 32) {
    return svgLayer(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <path d="M16 4L28 28H4Z" fill="none" stroke="${color}" stroke-width="1.3"/>
      </svg>`
    );
  }

  const WALLPAPERS = [
    {
      id: "gradient",
      name: "Midnight",
      css:
        "linear-gradient(160deg, #0c1219 0%, #0a0e14 40%, #12101a 100%), radial-gradient(ellipse 70% 50% at 85% 10%, rgba(91, 156, 255, 0.12), transparent)",
    },
    {
      id: "ocean-dusk",
      name: "Ocean dusk",
      css: "linear-gradient(165deg, #071825 0%, #0b2a3d 45%, #123048 100%), radial-gradient(ellipse 60% 45% at 20% 80%, rgba(56, 189, 248, 0.18), transparent)",
    },
    {
      id: "ember",
      name: "Ember",
      css: "linear-gradient(150deg, #1a0e0c 0%, #2a1210 40%, #1c1018 100%), radial-gradient(ellipse 55% 50% at 90% 15%, rgba(251, 146, 60, 0.22), transparent)",
    },
    {
      id: "forest",
      name: "Forest night",
      css: "linear-gradient(160deg, #0a1410 0%, #0d1c16 50%, #101810 100%), radial-gradient(ellipse 50% 40% at 15% 20%, rgba(52, 211, 153, 0.16), transparent)",
    },
    {
      id: "violet-haze",
      name: "Violet haze",
      css: "linear-gradient(155deg, #120f1c 0%, #1a1428 45%, #0e1018 100%), radial-gradient(ellipse 65% 50% at 80% 30%, rgba(167, 139, 250, 0.2), transparent)",
    },
    {
      id: "aurora",
      name: "Aurora",
      css: "linear-gradient(135deg, #07141f 0%, #0c1f2a 40%, #132018 100%), radial-gradient(ellipse 50% 40% at 30% 40%, rgba(45, 212, 191, 0.2), transparent), radial-gradient(ellipse 40% 35% at 75% 25%, rgba(129, 140, 248, 0.18), transparent)",
    },
    {
      id: "nebula",
      name: "Nebula",
      css: "linear-gradient(135deg, #0c0a14 0%, #161028 40%, #0a1018 100%), radial-gradient(ellipse 40% 35% at 25% 30%, rgba(192, 132, 252, 0.22), transparent), radial-gradient(ellipse 35% 30% at 80% 60%, rgba(56, 189, 248, 0.14), transparent)",
    },
    {
      id: "cobalt",
      name: "Cobalt",
      css: "linear-gradient(150deg, #070d1a 0%, #0c1840 45%, #0a1024 100%), radial-gradient(ellipse 55% 50% at 90% 40%, rgba(59, 130, 246, 0.25), transparent)",
    },

    {
      id: "paper",
      name: "Soft paper",
      css: `linear-gradient(180deg, #f7f5f0 0%, #efebe3 100%), ${dots("rgba(30,40,50,0.08)", 22, 1.1)}`,
      size: "auto, 22px 22px",
      repeat: "no-repeat, repeat",
    },
    {
      id: "cloud-day",
      name: "Cloud day",
      css: "linear-gradient(180deg, #dbeafe 0%, #eff6ff 40%, #f8fafc 100%), radial-gradient(ellipse 50% 30% at 20% 20%, rgba(255,255,255,0.9), transparent), radial-gradient(ellipse 40% 25% at 70% 15%, rgba(255,255,255,0.75), transparent)",
    },
    {
      id: "peach-cream",
      name: "Peach cream",
      css: "linear-gradient(160deg, #fff1e6 0%, #ffe4d6 45%, #fde8ef 100%)",
    },
    {
      id: "mint-cream",
      name: "Mint cream",
      css: "linear-gradient(150deg, #ecfdf5 0%, #e0f2fe 50%, #f0fdfa 100%)",
    },
    {
      id: "lilac-mist",
      name: "Lilac mist",
      css: "linear-gradient(145deg, #f5f3ff 0%, #ede9fe 40%, #fae8ff 100%)",
    },
    {
      id: "ivory-gold",
      name: "Ivory gold",
      css: "linear-gradient(180deg, #fffbeb 0%, #fef3c7 55%, #ffedd5 100%)",
    },
    {
      id: "sky-linen",
      name: "Sky linen",
      css: "linear-gradient(165deg, #e0f2fe 0%, #f0f9ff 40%, #f8fafc 100%)",
    },
    {
      id: "rose-quartz",
      name: "Rose quartz",
      css: "linear-gradient(150deg, #fff1f2 0%, #fce7f3 50%, #fae8ff 100%)",
    },
    {
      id: "seafoam",
      name: "Seafoam",
      css: "linear-gradient(160deg, #ccfbf1 0%, #e0f2fe 50%, #ecfeff 100%)",
    },
    {
      id: "warm-sand",
      name: "Warm sand",
      css: "linear-gradient(155deg, #faf6f1 0%, #f5e6d3 55%, #efe2d0 100%)",
    },

    {
      id: "sunset-bloom",
      name: "Sunset bloom",
      css: "linear-gradient(135deg, #fb7185 0%, #fb923c 40%, #fbbf24 70%, #f472b6 100%)",
    },
    {
      id: "tropical",
      name: "Tropical",
      css: "linear-gradient(145deg, #22d3ee 0%, #34d399 45%, #a3e635 100%)",
    },
    {
      id: "candy-pop",
      name: "Candy pop",
      css: "linear-gradient(120deg, #a78bfa 0%, #f472b6 45%, #fb923c 100%)",
    },
    {
      id: "electric-lime",
      name: "Electric lime",
      css: "linear-gradient(150deg, #84cc16 0%, #22c55e 40%, #06b6d4 100%)",
    },
    {
      id: "berry-wave",
      name: "Berry wave",
      css: "linear-gradient(160deg, #7c3aed 0%, #db2777 50%, #ea580c 100%)",
    },
    {
      id: "ocean-glass",
      name: "Ocean glass",
      css: "linear-gradient(160deg, #0ea5e9 0%, #06b6d4 40%, #2dd4bf 100%)",
    },
    {
      id: "mango",
      name: "Mango",
      css: "linear-gradient(145deg, #f97316 0%, #fbbf24 50%, #fde047 100%)",
    },
    {
      id: "iris-field",
      name: "Iris field",
      css: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 40%, #d946ef 100%)",
    },
    {
      id: "nordic-blue",
      name: "Nordic blue",
      css: "linear-gradient(170deg, #bfdbfe 0%, #93c5fd 40%, #60a5fa 100%)",
    },
    {
      id: "coral-reef",
      name: "Coral reef",
      css: "linear-gradient(150deg, #fb7185 0%, #f472b6 35%, #38bdf8 100%)",
    },

    {
      id: "sunrise-field",
      name: "Sunrise field",
      css: sunHorizon("#7dd3fc", "#fed7aa", "#fbbf24", "#65a30d"),
      size: "cover",
      repeat: "no-repeat",
      position: "center",
    },
    {
      id: "dusk-hills",
      name: "Dusk hills",
      css: `${mountains("#312e81", "#7c3aed", "#1e1b4b")}, linear-gradient(180deg, #fca5a5 0%, #fdba74 45%, #312e81 100%)`,
      size: "cover, auto",
      repeat: "no-repeat, no-repeat",
      position: "center bottom, center",
    },
    {
      id: "alpine",
      name: "Alpine",
      css: `${mountains("#94a3b8", "#64748b", "#334155")}, linear-gradient(180deg, #bae6fd 0%, #e0f2fe 55%, #94a3b8 100%)`,
      size: "cover, auto",
      repeat: "no-repeat, no-repeat",
      position: "center bottom, center",
    },
    {
      id: "teal-waves",
      name: "Teal waves",
      css: `${waves("#0d9488", "#115e59")}, linear-gradient(180deg, #99f6e4 0%, #5eead4 40%, #0f766e 100%)`,
      size: "100% 45%, auto",
      repeat: "no-repeat, no-repeat",
      position: "bottom, center",
    },
    {
      id: "ink-waves",
      name: "Ink waves",
      css: `${waves("#1e3a8a", "#312e81")}, linear-gradient(180deg, #93c5fd 0%, #6366f1 55%, #1e1b4b 100%)`,
      size: "100% 48%, auto",
      repeat: "no-repeat, no-repeat",
      position: "bottom, center",
    },
    {
      id: "pastel-blobs",
      name: "Pastel blobs",
      css: blobs("#fdf4ff", "#f9a8d4", "#a5b4fc", "#6ee7b7"),
      size: "cover",
      repeat: "no-repeat",
      position: "center",
    },
    {
      id: "citrus-blobs",
      name: "Citrus blobs",
      css: blobs("#fffbeb", "#fdba74", "#fde047", "#86efac"),
      size: "cover",
      repeat: "no-repeat",
      position: "center",
    },
    {
      id: "night-blobs",
      name: "Night blobs",
      css: blobs("#0f172a", "#6366f1", "#ec4899", "#22d3ee"),
      size: "cover",
      repeat: "no-repeat",
      position: "center",
    },
    {
      id: "golden-hour",
      name: "Golden hour",
      css: sunHorizon("#fda4af", "#fdba74", "#fef08a", "#9a3412"),
      size: "cover",
      repeat: "no-repeat",
      position: "center",
    },
    {
      id: "blue-hour",
      name: "Blue hour",
      css: sunHorizon("#1e3a8a", "#312e81", "#fde68a", "#0f172a"),
      size: "cover",
      repeat: "no-repeat",
      position: "center",
    },
    {
      id: "meadow",
      name: "Meadow",
      css: `${mountains("#4ade80", "#16a34a", "#14532d")}, linear-gradient(180deg, #bae6fd 0%, #86efac 60%, #4ade80 100%)`,
      size: "cover, auto",
      repeat: "no-repeat, no-repeat",
      position: "center bottom, center",
    },

    {
      id: "dot-grid-light",
      name: "Dot grid light",
      css: `${dots("rgba(51,65,85,0.18)", 20, 1.2)}, linear-gradient(180deg, #f8fafc, #e2e8f0)`,
      size: "20px 20px, auto",
      repeat: "repeat, no-repeat",
    },
    {
      id: "dot-grid-dark",
      name: "Dot grid dark",
      css: `${dots("rgba(148,163,184,0.28)", 22, 1.3)}, linear-gradient(180deg, #0f172a, #1e293b)`,
      size: "22px 22px, auto",
      repeat: "repeat, no-repeat",
    },
    {
      id: "blueprint",
      name: "Blueprint",
      css: `${grid("rgba(56,189,248,0.35)", 32)}, linear-gradient(180deg, #0c4a6e, #082f49)`,
      size: "32px 32px, auto",
      repeat: "repeat, no-repeat",
    },
    {
      id: "notebook",
      name: "Notebook",
      css: `${grid("rgba(148,163,184,0.45)", 28)}, linear-gradient(180deg, #ffffff, #f1f5f9)`,
      size: "28px 28px, auto",
      repeat: "repeat, no-repeat",
    },
    {
      id: "slash-mint",
      name: "Slash mint",
      css: `${diagonal("rgba(15,118,110,0.28)", 14)}, linear-gradient(135deg, #ccfbf1, #99f6e4)`,
      size: "14px 14px, auto",
      repeat: "repeat, no-repeat",
    },
    {
      id: "slash-ink",
      name: "Slash ink",
      css: `${diagonal("rgba(255,255,255,0.12)", 16)}, linear-gradient(145deg, #111827, #1f2937)`,
      size: "16px 16px, auto",
      repeat: "repeat, no-repeat",
    },
    {
      id: "hex-field",
      name: "Hex field",
      css: `${hexes("rgba(99,102,241,0.45)")}, linear-gradient(160deg, #eef2ff, #e0e7ff)`,
      size: "36px 31px, auto",
      repeat: "repeat, no-repeat",
    },
    {
      id: "hex-night",
      name: "Hex night",
      css: `${hexes("rgba(165,180,252,0.35)")}, linear-gradient(160deg, #1e1b4b, #312e81)`,
      size: "36px 31px, auto",
      repeat: "repeat, no-repeat",
    },
    {
      id: "chevron-pop",
      name: "Chevron pop",
      css: `${chevrons("rgba(255,255,255,0.35)")}, linear-gradient(135deg, #f97316, #ef4444)`,
      size: "28px 28px, auto",
      repeat: "repeat, no-repeat",
    },
    {
      id: "ring-orbit",
      name: "Ring orbit",
      css: `${rings("rgba(14,165,233,0.35)")}, linear-gradient(160deg, #ecfeff, #e0f2fe)`,
      size: "64px 64px, auto",
      repeat: "repeat, no-repeat",
    },
    {
      id: "triangle-mosaic",
      name: "Triangle mosaic",
      css: `${triangles("rgba(124,58,237,0.4)")}, linear-gradient(145deg, #faf5ff, #f3e8ff)`,
      size: "32px 32px, auto",
      repeat: "repeat, no-repeat",
    },
    {
      id: "checker-soft",
      name: "Checker soft",
      css: "repeating-conic-gradient(#e2e8f0 0% 25%, #f8fafc 0% 50%) 0 0 / 36px 36px",
    },
    {
      id: "checker-noir",
      name: "Checker noir",
      css: "repeating-conic-gradient(#1e293b 0% 25%, #0f172a 0% 50%) 0 0 / 40px 40px",
    },
    {
      id: "stripe-sunrise",
      name: "Stripe sunrise",
      css: "repeating-linear-gradient(135deg, #fb923c 0 14px, #f97316 14px 28px, #ef4444 28px 42px, #e11d48 42px 56px)",
    },
    {
      id: "stripe-ocean",
      name: "Stripe ocean",
      css: "repeating-linear-gradient(120deg, #0ea5e9 0 16px, #0284c7 16px 32px, #0369a1 32px 48px)",
    },
    {
      id: "stripe-candy",
      name: "Stripe candy",
      css: "repeating-linear-gradient(90deg, #fbcfe8 0 18px, #e9d5ff 18px 36px, #c7d2fe 36px 54px)",
    },
    {
      id: "conic-prism",
      name: "Prism spin",
      css: "conic-gradient(from 210deg, #22d3ee, #a78bfa, #f472b6, #fbbf24, #22d3ee)",
    },
    {
      id: "conic-ice",
      name: "Ice spin",
      css: "conic-gradient(from 40deg at 50% 50%, #e0f2fe, #bae6fd, #7dd3fc, #38bdf8, #e0f2fe)",
    },
    {
      id: "radial-burst",
      name: "Radial burst",
      css: "radial-gradient(circle at 30% 30%, #fef08a 0%, #fb923c 28%, #db2777 58%, #4c1d95 100%)",
    },
    {
      id: "radial-pool",
      name: "Radial pool",
      css: "radial-gradient(circle at 70% 20%, #a5f3fc 0%, #22d3ee 35%, #0284c7 70%, #0f172a 100%)",
    },
    {
      id: "mesh-pink",
      name: "Mesh pink",
      css: "radial-gradient(at 20% 20%, #fbcfe8 0px, transparent 45%), radial-gradient(at 80% 10%, #c4b5fd 0px, transparent 40%), radial-gradient(at 50% 80%, #fda4af 0px, transparent 45%), #fff1f2",
    },
    {
      id: "mesh-mint",
      name: "Mesh mint",
      css: "radial-gradient(at 10% 30%, #99f6e4 0px, transparent 45%), radial-gradient(at 90% 20%, #93c5fd 0px, transparent 40%), radial-gradient(at 40% 90%, #bbf7d0 0px, transparent 45%), #f0fdfa",
    },
    {
      id: "mesh-night",
      name: "Mesh night",
      css: "radial-gradient(at 15% 20%, rgba(99,102,241,0.45) 0px, transparent 45%), radial-gradient(at 85% 25%, rgba(236,72,153,0.35) 0px, transparent 40%), radial-gradient(at 50% 85%, rgba(34,211,238,0.25) 0px, transparent 45%), #020617",
    },
    {
      id: "horizon-lines",
      name: "Horizon lines",
      css: "repeating-linear-gradient(180deg, transparent 0 18px, rgba(15,23,42,0.06) 18px 19px), linear-gradient(180deg, #fef3c7, #fdba74 55%, #fb7185)",
    },
    {
      id: "pixel-dusk",
      name: "Pixel dusk",
      css: "repeating-linear-gradient(0deg, transparent 0 10px, rgba(0,0,0,0.08) 10px 11px), repeating-linear-gradient(90deg, transparent 0 10px, rgba(0,0,0,0.08) 10px 11px), linear-gradient(135deg, #7c3aed, #db2777, #f97316)",
    },
    {
      id: "glass-panels",
      name: "Glass panels",
      css: "linear-gradient(120deg, rgba(255,255,255,0.35) 0 18%, transparent 18% 38%, rgba(255,255,255,0.2) 38% 52%, transparent 52% 72%, rgba(255,255,255,0.28) 72% 100%), linear-gradient(160deg, #38bdf8, #6366f1 55%, #a855f7)",
    },
    {
      id: "paper-craft",
      name: "Paper craft",
      css: `${dots("rgba(120,113,108,0.2)", 18, 1)}, linear-gradient(145deg, #fafaf9 0%, #f5f5f4 40%, #e7e5e4 100%)`,
      size: "18px 18px, auto",
      repeat: "repeat, no-repeat",
    },
    {
      id: "olive-studio",
      name: "Olive studio",
      css: "linear-gradient(160deg, #ecfccb 0%, #d9f99d 40%, #bef264 100%)",
    },
    {
      id: "clay",
      name: "Clay",
      css: "linear-gradient(150deg, #ffedd5 0%, #fed7aa 45%, #fdba74 100%)",
    },
    {
      id: "denim",
      name: "Denim",
      css: `${diagonal("rgba(255,255,255,0.12)", 10)}, linear-gradient(160deg, #1d4ed8, #1e3a8a 55%, #172554)`,
      size: "10px 10px, auto",
      repeat: "repeat, no-repeat",
    },
    {
      id: "sakura",
      name: "Sakura",
      css: "radial-gradient(circle at 20% 30%, rgba(251,113,133,0.35) 0 8%, transparent 9%), radial-gradient(circle at 70% 20%, rgba(244,114,182,0.3) 0 6%, transparent 7%), radial-gradient(circle at 40% 70%, rgba(251,146,60,0.2) 0 7%, transparent 8%), linear-gradient(180deg, #fff1f2, #fce7f3 60%, #fbcfe8)",
    },
    {
      id: "bamboo",
      name: "Bamboo light",
      css: "repeating-linear-gradient(90deg, #d9f99d 0 22px, #bbf7d0 22px 28px, #86efac 28px 34px), linear-gradient(180deg, #f7fee7, #ecfccb)",
    },
  ];

  function clearShellWallpaperStyles(shell) {
    if (!shell) return;
    shell.style.background = "";
    shell.style.backgroundImage = "";
    shell.style.backgroundSize = "";
    shell.style.backgroundPosition = "";
    shell.style.backgroundRepeat = "";
    shell.style.backgroundColor = "";
    shell.style.backgroundBlendMode = "";
  }

  function applyCssWallpaper(el, wp) {
    clearShellWallpaperStyles(el);
    el.style.background = wp.css;
    el.style.backgroundSize = wp.size || "";
    el.style.backgroundPosition = wp.position || "";
    el.style.backgroundRepeat = wp.repeat || "";
    if (wp.fallback) el.style.backgroundColor = wp.fallback;
  }

  function applyPhotoWallpaper(el, wp) {
    const url = wp.photoUrl;
    const color = wp.fallback || "#1a2332";
    if (!url) {
      applyCssWallpaper(el, { css: color });
      return;
    }

    const paint = () => {
      el.style.backgroundColor = color;
      el.style.backgroundImage = `url("${url}")`;
      el.style.backgroundSize = "cover";
      el.style.backgroundPosition = "center center";
      el.style.backgroundRepeat = "no-repeat";
      el.style.backgroundBlendMode = "";
    };

    const img = new Image();
    img.onload = paint;
    img.onerror = paint;
    img.src = url;
    if (img.complete && img.naturalWidth > 0) paint();
  }

  function applyWallpaperStyles(el, wp) {
    if (!el || !wp) return;
    if (wp.photo && wp.photoUrl) {
      applyPhotoWallpaper(el, wp);
      return;
    }
    applyCssWallpaper(el, wp);
  }

  function getWallpaper(id) {
    return WALLPAPERS.find((w) => w.id === id) || WALLPAPERS[0];
  }

  const ROTATE_MS = 5 * 60 * 1000;
  let rotateTimer = null;
  let rotateDelayTimer = null;
  let syncedPlaylistKey = "";

  function clearRotationTimers() {
    if (rotateTimer) {
      clearInterval(rotateTimer);
      rotateTimer = null;
    }
    if (rotateDelayTimer) {
      clearTimeout(rotateDelayTimer);
      rotateDelayTimer = null;
    }
  }

  function knownIds() {
    return new Set(WALLPAPERS.map((w) => w.id));
  }

  function normalizePlaylist(ids) {
    const known = knownIds();
    return [...new Set((Array.isArray(ids) ? ids : []).map((id) => String(id)).filter((id) => known.has(id)))];
  }

  function getPlaylist() {
    return normalizePlaylist(window.MySpaceConfig?.getSettings?.()?.wallpaperPlaylist);
  }

  function applyWallpaper(id) {
    const wp = getWallpaper(id);
    const shell = document.querySelector(".shell");
    if (!shell) return wp;
    applyWallpaperStyles(shell, wp);
    shell.dataset.wallpaper = wp.id;
    return wp;
  }

  function getCurrentId() {
    return (
      window.MySpaceConfig?.getSettings?.()?.wallpaper ||
      document.querySelector(".shell")?.dataset?.wallpaper ||
      "gradient"
    );
  }

  function rotateNext() {
    const playlist = getPlaylist();
    if (playlist.length < 2) {
      syncedPlaylistKey = "";
      syncRotation();
      return;
    }
    const current = getCurrentId();
    let idx = playlist.indexOf(current);
    idx = idx < 0 ? 0 : (idx + 1) % playlist.length;
    const nextId = playlist[idx];
    applyWallpaper(nextId);
    window.MySpaceConfig?.updateSettings?.({
      wallpaper: nextId,
      wallpaperRotatedAt: Date.now(),
    });
    window.dispatchEvent(
      new CustomEvent("myspace-wallpaper-rotated", { detail: { id: nextId, playlist } })
    );
  }

  function syncRotation() {
    const playlist = getPlaylist();
    const key = playlist.length >= 2 ? playlist.join("|") : "";
    if (key && key === syncedPlaylistKey && (rotateTimer || rotateDelayTimer)) {
      return;
    }

    clearRotationTimers();
    syncedPlaylistKey = key;
    if (!key) return;

    const last = Number(window.MySpaceConfig?.getSettings?.()?.wallpaperRotatedAt) || 0;
    const elapsed = last > 0 ? Date.now() - last : 0;
    const delay = Math.max(1000, ROTATE_MS - Math.min(elapsed, ROTATE_MS));

    rotateDelayTimer = setTimeout(() => {
      rotateNext();
      rotateTimer = setInterval(rotateNext, ROTATE_MS);
    }, delay);
  }

  function togglePlaylist(id) {
    if (!knownIds().has(id)) return getPlaylist();
    let list = getPlaylist();
    if (!list.length) {
      const current = getCurrentId();
      if (current && current !== id && knownIds().has(current)) {
        list = [current];
      }
    }
    const idx = list.indexOf(id);
    if (idx >= 0) list.splice(idx, 1);
    else list.push(id);

    const patch = { wallpaperPlaylist: list };
    if (idx < 0) {
      applyWallpaper(id);
      patch.wallpaper = id;
      patch.wallpaperRotatedAt = Date.now();
    } else if (getCurrentId() === id && list.length) {
      applyWallpaper(list[0]);
      patch.wallpaper = list[0];
      patch.wallpaperRotatedAt = Date.now();
    }

    window.MySpaceConfig?.updateSettings?.(patch);
    syncRotation();
    return list;
  }

  function setPlaylist(ids) {
    const list = normalizePlaylist(ids);
    const patch = { wallpaperPlaylist: list };
    if (list.length) {
      const current = getCurrentId();
      if (!list.includes(current)) {
        applyWallpaper(list[0]);
        patch.wallpaper = list[0];
        patch.wallpaperRotatedAt = Date.now();
      }
    }
    window.MySpaceConfig?.updateSettings?.(patch);
    syncRotation();
    return list;
  }

  window.MySpaceWallpapers = {
    list: WALLPAPERS,
    get: getWallpaper,
    apply: applyWallpaper,
    applyStyles: applyWallpaperStyles,
    getCurrentId,
    getPlaylist,
    togglePlaylist,
    setPlaylist,
    syncRotation,
    ROTATE_MS,
  };
})();
