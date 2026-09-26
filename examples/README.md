# Local pocket classics

Eleven self-contained Hugame packages with original code and real gameplay cover art:

- `flappy-finch/`: Flappy-style tap/Space flying game.
- `2048/`: sliding tile puzzle with arrows, WASD, swipe, and touch buttons.
- `neon-snake/`: Snake with arrows, WASD, swipe, and touch buttons.
- `minesweeper/`: a keyboard, mouse, and touch-friendly beginner minefield.
- `pong/`: one-player Pong against a computer paddle.
- `sudoku/`: a shuffled classic number puzzle with keyboard and touch input.
- `tic-tac-toe/`: three-in-a-row against a computer opponent.
- `game-of-life/`: an interactive Conway's Game of Life sandbox.
- `gold-miner/`: a timed claw-and-treasure arcade game with saves and achievements.
- `pelican-pedal/`: a rhythmic seaside bike ride with gaps, monsters, saves, and achievements.
- `match-3-puzzle/`: a colorful cascading tile puzzle with ten progressive levels.

Each game has a manifest, cover, HTML, CSS, and bundled JavaScript. Open through a local HTTP server (JavaScript modules do not reliably load from file URLs). The Hugame private previews provide that server after upload.

## Two sound approaches

The examples intentionally demonstrate both supported ways to bundle sound while remaining self-contained:

- Synthesized Web Audio effects: `2048`, `game-of-life`, `match-3-puzzle`, `neon-snake`, `pelican-pedal`, and `tic-tac-toe` generate short tones at runtime in `scripts/sound.js`.
- Static audio effects: `flappy-finch`, `gold-miner`, `minesweeper`, `pong`, and `sudoku` play bundled WAV files from `assets/sounds/`.

Both approaches expose the same `playSound(...)` helper, start audio only after player input, and respond to the Hugame `mute` event. Regenerate the WAV files with `node scripts/generate-example-sounds.mjs` from the repository root.

From the sibling `hugame` repository, `node scripts/prepare-demo-games.mjs` regenerates covers and checks keyboard/touch controls, restart, narrow layouts, round endings, and 2048 merge rules using Chromium.

With the local app on port 3000 and container services running, run `npx tsx scripts/seed-local-games.ts` from the sibling `hugame` repository. It validates/packages these games, creates fictional `.test` demo accounts as needed, uploads private drafts, and checks their authenticated previews. It refuses non-local storage URLs and verifies the account exists in the container database. Rerunning creates new versions of the same saved game IDs, not new game cards. It never publishes.

Login details and preview URLs are in `data/local-demo-accounts.local.json`, an ignored mode-0600 file. Do not commit it or reuse those passwords elsewhere. Screenshots in `data/demo-previews/` are also ignored. Log in as the corresponding demo account at `http://localhost:3000/signin`, then open My games to play its draft.

After explicit approval to publish all eleven saved versions, run `node scripts/publish-local-demos.mjs --yes`. It publishes only those demo game/version IDs and verifies anonymous public play and catalog visibility. Run `npm run dev:local` for both the app and the local public-game gateway.
