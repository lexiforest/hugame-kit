# Hugame Package v1

Package the contents of the output folder, not an enclosing folder:

```text
hugame.json
index.html
cover.png          exactly one of cover.png or cover.webp
assets/            optional
scripts/           optional
styles/            optional
```

The bundled Ping Pong game is a complete example. A minimal manifest with scores:

```json
{
  "schemaVersion": 1,
  "title": "Ping Pong",
  "description": "Play a quick paddle match against the computer.",
  "license": "MIT",
  "homepage": "https://github.com/someone/ping-pong",
  "instructions": "Move with W/S, the arrow keys, touch, or the on-screen buttons.",
  "orientation": "landscape",
  "controls": ["Arrow keys", "WASD", "Touch", "Touch buttons"],
  "tags": ["sports"],
  "display": { "mode": "responsive" },
  "capabilities": ["scores"],
  "score": { "label": "Points", "order": "higher" }
}
```

For a game without scores, set `capabilities` to `[]` and omit `score`. `license` names the source license and defaults to `MIT` when omitted. `homepage` is optional and, when present, must be an `http://` or `https://` URL. Orientation is `portrait`, `landscape`, or `any`. Score order is `higher` or `lower`. Choose 1–5 unique tags from: puzzle, racing, sports, strategy, adventure, educational, others. Unknown manifest fields are rejected. The site serves the full schema at `/schemas/hugame-v1.schema.json`.

## Optional runtime features

`capabilities` accepts unique `scores`, `progress`, and `achievements` entries. Progress stores a small versioned JSON checkpoint. Achievements require a matching `achievements` array of 1–100 definitions, each with unique `id` (lowercase letter followed by up to 63 lowercase letters, digits, `_` or `-`), `title` (1–80 characters), `description` (1–300 characters), and integer `target` (1–1,000,000,000). Omit definitions when the capability is disabled. Stable IDs preserve unlocks across uploads.

Every package must declare `display`. Choose `display: { "mode": "fixed", "width": 360, "height": 640 }` for a fixed logical viewport scaled uniformly to fit, or `display: { "mode": "responsive" }` to fill the player and reflow. Fixed dimensions are integers from 160 to 4096. Keep `orientation` at the manifest top level; it is a preference, not forced rotation. See [runtime bridge](runtime.md) for APIs, save conflicts, and the no-scroll layout contract.

## File limits

- Cover: PNG or WebP, exactly 16:10, at least 640×400, at most 2 MiB.
- ZIP: at most 50 MiB; extracted total 100 MiB; each file 25 MiB; at most 500 files.
- Use relative local URLs, case-consistent names, and the three optional folders above. No symlinks, traversal, duplicate/case-colliding paths, hidden files, or server executables.
- Keep source maps, development configs, dependency folders, credentials, and the resulting ZIP outside the output folder.
- HTML, CSS, JavaScript, JSON, supported raster images, fonts, audio/video, and WebAssembly are static assets. The validator checks the allowed extensions and file signatures.
- The web uploader accepts either the normal root layout or one enclosing game folder, including harmless Finder metadata. It rejects multiple unrelated roots. The CLI always creates the preferred root layout.

## Self-contained games

No external URLs or runtime network access: bundle fonts, libraries, images, audio, and data. No analytics, remote imports, fetch/XHR, WebSockets, service workers, dynamic script injection, `eval`, or `new Function`. Use local script tags or bundled scripts. Do not collect personal data or add login/payment forms.

The runtime has an opaque sandbox origin. Do not depend on cookies, localStorage, parent DOM access, popups, navigation, or server endpoints. The platform's narrow bridge is the only supported site interaction. Local lint catches common mistakes; the sandbox and browser policy enforce isolation. Never weaken them to make a game work.

With Node.js 22 or later, use `npx hugame pack GAME_FOLDER --out OUTPUT.zip` to produce a validated ZIP outside the game folder. The command refuses to overwrite an existing ZIP. Without compatible Node.js, check the package against this document and create a ZIP containing the package contents, not the enclosing folder; state that it was not CLI-validated. See [CLI commands and no-CLI workflows](commands.md#archive-pack) for exact packing behavior and fallback examples.
