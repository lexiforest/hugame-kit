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

The bundled Star Catcher is a complete example. A minimal manifest with scores:

```json
{
  "schemaVersion": 1,
  "title": "Star Catcher",
  "description": "Catch stars before time runs out.",
  "instructions": "Tap a star, or move with arrow keys and press Space.",
  "orientation": "landscape",
  "controls": ["Arrow keys and Space", "Touch"],
  "tags": ["arcade", "kids"],
  "capabilities": ["scores"],
  "score": { "label": "Stars", "order": "higher" }
}
```

For a game without scores, set `capabilities` to `[]` and omit `score`. Orientation is `portrait`, `landscape`, or `any`. Score order is `higher` or `lower`. Choose 1–5 unique tags from: arcade, puzzle, platformer, racing, sports, strategy, adventure, educational, kids. Unknown manifest fields are rejected. The site serves the full schema at `/schemas/hugame-v1.schema.json`.

## Optional runtime features

`capabilities` accepts unique `scores`, `progress`, and `achievements` entries. Progress stores a small versioned JSON checkpoint. Achievements require a matching `achievements` array of 1–100 definitions, each with unique `id` (lowercase letter followed by up to 63 lowercase letters, digits, `_` or `-`), `title` (1–80 characters), `description` (1–300 characters), and integer `target` (1–1,000,000,000). Omit definitions when the capability is disabled. Stable IDs preserve unlocks across uploads.

Choose `display: { "mode": "fixed", "width": 360, "height": 640 }` for a fixed logical viewport scaled uniformly to fit, or `display: { "mode": "responsive" }` to fill the player and reflow. Fixed dimensions are integers from 160 to 4096. Omitting display retains legacy responsive behavior. Keep `orientation` at the manifest top level; it is a preference, not forced rotation. See [runtime bridge](runtime.md) for APIs, save conflicts, and the no-scroll layout contract.

## File limits

- Cover: PNG or WebP, exactly 16:9, at least 640×360, at most 2 MiB.
- ZIP: at most 50 MiB; extracted total 100 MiB; each file 25 MiB; at most 500 files.
- Use relative local URLs, case-consistent names, and the three optional folders above. No symlinks, traversal, duplicate/case-colliding paths, hidden files, or server executables.
- Keep source maps, development configs, dependency folders, credentials, and the resulting ZIP outside the output folder.
- HTML, CSS, JavaScript, JSON, supported raster images, fonts, audio/video, and WebAssembly are static assets. The validator checks the allowed extensions and file signatures.
- The web uploader accepts either the normal root layout or one enclosing game folder, including harmless Finder metadata. It rejects multiple unrelated roots. The CLI always creates the preferred root layout.

## Self-contained games

No external URLs or runtime network access: bundle fonts, libraries, images, audio, and data. No analytics, remote imports, fetch/XHR, WebSockets, service workers, dynamic script injection, `eval`, or `new Function`. Use local script tags or bundled scripts. Do not collect personal data or add login/payment forms.

The runtime has an opaque sandbox origin. Do not depend on cookies, localStorage, parent DOM access, popups, navigation, or server endpoints. The platform's narrow bridge is the only supported site interaction. Local lint catches common mistakes; the sandbox and browser policy enforce isolation. Never weaken them to make a game work.

Use `hugame pack GAME_FOLDER --out OUTPUT.zip` to produce a validated ZIP outside the game folder. The command refuses to overwrite an existing ZIP.
