---
name: hugame
description: Create, test, package, upload, and publish static web games for Hugame. Use when making a Hugame game, debugging its local player, fixing package errors, previewing a private draft, or updating a release.
---

# Create and share a Hugame game

Use the Hugame CLI for local creation, package checks, the sandboxed development player, device login, uploads, and publishing. Do not recreate authentication with curl or request a password or API token in chat. The production site is `https://hugame.dev`; staging is `https://staging.hugame.dev`. Before login or another site operation, confirm which environment the user intends if it is not already clear. Local creation, validation, and packing do not need a site or account.

## Prepare a game

Read [package format](references/package.md) before adapting a game. Keep the user's source project intact; for a framework project, make a separate static export folder containing only the package files. Bundle dependencies and assets locally.

Use `hugame init my-game` for a new starter, or copy `assets/star-catcher/` from this skill into an empty output folder. Start from the user's idea and change the example rather than presenting Star Catcher as the finished result. Read [runtime bridge](references/runtime.md) when adding lifecycle events, scores, saves, achievements, or fitting the game to the player. Games must fit without scrollbars; test that controls remain visible on portrait and landscape phones.

The CLI requires Node.js 22 or later. Check `hugame --version` before use. This skill targets CLI 0.1.0 and package schema 1. If the CLI is unavailable, use the site's installation instructions or its web ZIP uploader. Do not install an unrelated package with a similar name. A `hugame-kit` source checkout can build the CLI with `npm run build:cli`.

## Upload a private draft

1. Run `hugame validate GAME_FOLDER`. Fix reported files and repeat. See [troubleshooting](references/troubleshooting.md) for failures.
2. Run `hugame dev GAME_FOLDER`. Use its lifecycle and viewport controls and runtime log to test start/restart, keyboard, touch if supported, narrow screens, a complete round, saves, and achievements. Reset local player state when testing first-run behavior. Stop the dev server when finished; validation is not a play test.
3. Let the account holder run `hugame login --site SITE_ORIGIN` and approve the displayed code in their browser. Use `https://hugame.dev` for production or `https://staging.hugame.dev` for staging. Do not approve on their behalf. The account holder must complete their birthday profile, and uploads are 13+; an under-13 creator needs an age-eligible adult to handle upload and publication using the adult's own account.
4. With permission to upload, run `hugame upload GAME_FOLDER --site SITE_ORIGIN`. For an existing game, confirm its ID with `hugame games` and pass `--game GAME_ID`; do not silently create a duplicate. Uploading creates a private draft, never a public release.
5. Give the user the returned private preview link. Check the preview in an authenticated browser when available, including assets, controls, and a full round. Otherwise ask the user to test it and accurately state that you have not verified it.

Use `--json` for machine-readable output. Login emits a pairing instruction before the final result. Never print or read the credentials file into the conversation, commit it, or include it in a game package.

## Publish only after confirmation

After a successful private preview, show the exact game title, target site, version, visibility (`public` or `unlisted`), and whether source downloading will be forkable. Ask for explicit confirmation to share that version with those settings. Creating, fixing, packing, uploading, or approving a device is not sharing approval.

Only after confirmation, run `hugame publish VERSION_ID --site SITE_ORIGIN --visibility VISIBILITY --forkable true|false --yes`. Prefer the returned version ID over the game ID so a different game cannot be selected accidentally. Return the play link and state whether it is public or unlisted and whether its source ZIP is downloadable.

For updates, warn that uploading replaces the existing build and makes the game private. Upload to the existing game ID, preview the private replacement, and obtain confirmation again before making it public or unlisted.

Stop on denied login, missing permission, or a failed preview; explain the next action without bypassing checks. On an ambiguous upload failure, retry the same folder unchanged once: the CLI can resume finalization. Do not repeatedly upload new copies or publish to test whether an error has cleared.
