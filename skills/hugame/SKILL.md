---
name: hugame
description: Create, test, package, upload, and publish static web games for Hugame with the CLI or documented no-CLI fallbacks. Use when making a Hugame game, debugging its local player, fixing package errors, previewing a private draft, or updating a release.
---

# Create, validate, pack and share a Hugame game

Hugame.dev is a platform for sharing simple one-page HTML5 games. This skill helps create games that satisfy the Hugame package format.

## When

Prefer the Hugame CLI for local creation, package checks, the sandboxed development player, device login, uploads, and publishing when Node.js is available. Do not recreate authentication with curl or request a password or API token in chat. The production site is `https://hugame.dev`; staging is `https://staging.hugame.dev`. Before login or another site operation, confirm which environment the user intends if it is not already clear. Local creation, validation, and packing do not need a site or account.

## Choose the package-check path

First run `node --version`. The CLI requires Node.js 22 or later.

- If Node.js 22 or later is installed, prefer `npx hugame` for every CLI operation. Start with `npx hugame --version`; this skill targets CLI 0.0.2 and package schema 1. Use the `hugame` package, not an unrelated similarly named package. A `hugame-kit` source checkout can instead build its local CLI with `npm run build:cli`.
- If Node.js is missing or older than 22, keep working without the CLI. Perform the documented text-based package check and use browser/site alternatives. State clearly which CLI-only checks were not exercised. Do not install Node unless the user asks.

Read [CLI commands and no-CLI workflows](references/commands.md) for the requested operation. It covers every command, option, default, side effect, and fallback boundary. Also read [package format](references/package.md) when creating, validating, or packing; [runtime bridge](references/runtime.md) when testing gameplay or SDK behavior; and [troubleshooting](references/troubleshooting.md) when a check or site operation fails.

## Prepare a game

Read [package format](references/package.md) before adapting a game. Keep the user's source project intact; for a framework project, make a separate static export folder containing only the package files. Bundle dependencies and assets locally.

With compatible Node.js, use `npx hugame init my-game` for a new starter. Without it, copy `assets/ping-pong/` from this skill into an empty output folder. Start from the user's idea and change the example rather than presenting Ping Pong as the finished result. Read [runtime bridge](references/runtime.md) when adding lifecycle events, scores, saves, achievements, or fitting the game to the player. Games must fit without scrollbars; test that controls remain visible on portrait and landscape phones.

## Upload a game

1. Run `npx hugame validate GAME_FOLDER`. Fix reported files and repeat. Without compatible Node.js, use the text-based package check above instead. See [troubleshooting](references/troubleshooting.md) for failures.
2. Run `npx hugame dev GAME_FOLDER`. Use its lifecycle and viewport controls and runtime log to test start/restart, keyboard, touch if supported, narrow screens, a complete round, saves, and achievements. Reset local player state when testing first-run behavior. Stop the dev server when finished; validation is not a play test. Without compatible Node.js, test `index.html` directly but do not claim that this reproduces the Hugame sandbox or bridge.
3. Let the account holder run `HUGAME_URL=SITE_ORIGIN npx hugame login` and approve the displayed code in their browser. Use `https://hugame.dev` for production or `https://staging.hugame.dev` for staging. A successful login remembers that site for later commands; an explicitly set `HUGAME_URL` overrides it. Do not approve on their behalf. The account holder must complete their birthday profile, and uploads are 13+; an under-13 creator needs an age-eligible adult to handle upload and publication using the adult's own account.
4. With permission to upload, run `npx hugame upload GAME_FOLDER`. A new game starts as a private draft. For an existing game, confirm its ID with `npx hugame games`, explain that uploading replaces the live version immediately while preserving its visibility and settings, and wait for confirmation before passing `--game GAME_ID`; do not silently create a duplicate.
5. Give the user the returned preview link. For a new game, check the private preview before publishing. For a replacement, also check its existing play link because the new version is already live when the game is public or unlisted. Otherwise ask the user to test it and accurately state that you have not verified it.

Use `--json` for machine-readable output. Login emits a pairing instruction before the final result. Never print or read the credentials file into the conversation, commit it, or include it in a game package.

## Publish only after confirmation

After a successful private preview, show the exact game title, target site, version, visibility (`public` or `unlisted`), and whether source downloading will be forkable. Ask for explicit confirmation to share that version with those settings. Creating, fixing, packing, uploading, or approving a device is not sharing approval.

Only after confirmation, run `npx hugame publish VERSION_ID --visibility VISIBILITY --forkable true|false --yes`. Prefer the returned version ID over the game ID so a different game cannot be selected accidentally. Return the play link and state whether it is public or unlisted and whether its source ZIP is downloadable.

For updates, validate and test locally before asking for upload confirmation. Uploading to the existing game ID replaces its only version immediately and preserves visibility, forkability, and other game settings; it does not require publishing again.

Stop on denied login, missing permission, or a failed preview; explain the next action without bypassing checks. On an ambiguous upload failure, retry the same folder unchanged once: the CLI can resume finalization. Do not repeatedly upload new copies or publish to test whether an error has cleared.
