---
name: hugame
description: Create, test, package, upload, and publish static web games for Hugame with the CLI or documented no-CLI fallbacks. Use when making a Hugame game, debugging its local player, fixing package errors, previewing a private draft, or updating a release.
---

# Create, validate, pack and share a Hugame game

Hugame.dev is a platform for sharing simple one-page HTML5 games. This skill helps create games that satisfy the Hugame package format.

## When

Prefer the Hugame CLI for local creation, package checks, the sandboxed development player, device login, uploads, and publishing when Node.js is available. Do not recreate authentication with curl or request a password or API token in chat. The CLI defaults to `https://hugame.dev`; advanced users can set `HUGAME_URL` to a custom Hugame-compatible origin. Local creation, validation, and packing do not need a site or account.

## Reuse the user's choices and authorization

Use the site the user explicitly requested; otherwise let the CLI use `HUGAME_URL`, its remembered site, or the default `https://hugame.dev`, in that order. Do not introduce a staging/production choice, ask why they chose a site, or change the site on your own. Ask only if their requested destination conflicts with the configured destination or is genuinely ambiguous.

A request to upload authorizes that upload. A request to update an identified existing game authorizes replacing its current version. A request to publish or share with specified visibility authorizes that action after verification. Retain these choices across turns; do not ask for the same permission again. Creating or fixing a game alone does not authorize upload or publication, and uploading alone does not authorize publication. Resolve only missing choices that affect the requested action.

## Choose the package-check path

First run `node --version`. The CLI requires Node.js 22 or later.

- If Node.js 22 or later is installed, prefer `npx hugame` for every CLI operation. Start with `npx hugame --version`; this skill targets package schema 1. Use the `hugame` package, not an unrelated similarly named package. A `hugame-kit` source checkout can instead build its local CLI with `npm run build:cli`.
- If Node.js is missing or older than 22, keep working without the CLI. Perform the documented text-based package check and use browser/site alternatives. State clearly which CLI-only checks were not exercised. Do not install Node unless the user asks.

Read [CLI commands and no-CLI workflows](references/commands.md) for the requested operation. It covers every command, option, default, side effect, and fallback boundary. Also read [package format](references/package.md) when creating, validating, or packing; [runtime bridge](references/runtime.md) when testing gameplay or SDK behavior; and [troubleshooting](references/troubleshooting.md) when a check or site operation fails.

## Prepare a game

Read [package format](references/package.md) before adapting a game. Keep the user's source project intact; for a framework project, make a separate static export folder containing only the package files. Bundle dependencies and assets locally.

With compatible Node.js, use `npx hugame init my-game` for a new starter. Without it, copy `assets/ping-pong/` from this skill into an empty output folder. Start from the user's idea and change the example rather than presenting Ping Pong as the finished result. Read [runtime bridge](references/runtime.md) when adding lifecycle events, scores, saves, achievements, or fitting the game to the player. Games must fit without scrollbars; test that controls remain visible on portrait and landscape phones.

## Upload a game

1. Run `npx hugame validate GAME_FOLDER`. Fix reported files and repeat. Without compatible Node.js, use the text-based package check above instead. See [troubleshooting](references/troubleshooting.md) for failures.
2. Run `npx hugame dev GAME_FOLDER`. Use its lifecycle and viewport controls and runtime log to test start/restart, keyboard, touch if supported, narrow screens, a complete round, saves, and achievements. Reset local player state when testing first-run behavior. Stop the dev server when finished; validation is not a play test. Without compatible Node.js, test `index.html` directly but do not claim that this reproduces the Hugame sandbox or bridge.
3. Check the existing session with `npx hugame info`, unless it has already succeeded for this operation. Reuse that account and credential. Run `npx hugame login` only when credentials are missing, expired, or revoked, or the user explicitly requests another account. Leave login running while the account holder approves the displayed code in their browser; do not approve for them. Every invocation of `login` starts a new pairing, so it is not a routine pre-upload step. Network errors, server errors, and age restrictions are not reasons to log in again. Login, uploads, updates, Draft previews, and Unlisted sharing do not require a birthday or minimum age. Only making a game Public requires a saved birth month/year and age 13 or older.
4. Run `npx hugame upload GAME_FOLDER` within the user's authorized scope. A new game starts as a private draft. For an update, identify the existing game from `info` and use `--game GAME_ID`; do not silently create a duplicate. Explain that replacement is immediate and preserves visibility and settings, then proceed when the user has requested that update. Ask only if the game to replace or permission to replace it is unclear. A folder's remembered association can also trigger replacement without `--game`, so do not treat every plain upload as creating a new game.
5. Give the user the returned preview link. For a new game, check the private preview before publishing. For a replacement, also check its existing play link because the new version is already live when the game is public or unlisted. Otherwise ask the user to test it and accurately state that you have not verified it.

CLI command results are JSON, while `--help` and `-h` print plain text. Login emits a device-authorization event before the final result. Never print or read the credentials file into the conversation, commit it, or include it in a game package.

## Publish within the requested scope

After a successful private preview, identify the exact game and version and use the requested visibility (`public` or `unlisted`). If the user has already authorized publication with those choices, proceed without another confirmation. Otherwise ask for the missing sharing approval or visibility choice. Preserve the current forkability unless the user requests a change; enabling source downloads is a separate choice, not a prerequisite to publishing. Creating, fixing, packing, uploading, or approving a device is not sharing approval.

Run `npx hugame publish VERSION_ID --visibility VISIBILITY --yes` once authorized. Add `--forkable true|false` only for a requested change. The `--yes` flag carries the user's existing authorization; it does not require another round of permission. Prefer the returned version ID over the game ID so a different game cannot be selected accidentally. Return the play link and resulting visibility; report forkability only when known. If Public publication is rejected for a missing birthday or age, explain the restriction without retrying login or silently switching visibility.

For updates, validate and test locally before uploading. Uploading to the existing game ID replaces its only version immediately and preserves visibility, forkability, and other game settings; it does not require publishing again.

Stop on denied login, missing permission, or a failed preview; explain the next action without bypassing checks. On an ambiguous upload failure, retry the same folder unchanged once: the CLI can resume finalization. Do not repeatedly upload new copies or publish to test whether an error has cleared.
