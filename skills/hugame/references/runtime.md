# Runtime bridge

Hugame injects `window.Hugame` before the entry page's scripts. Do not include a replacement bridge, a bearer token, or direct site API calls in game code. Optional chaining lets the same game run locally without the bridge.

```js
window.Hugame?.ready();
window.Hugame?.score(12);
window.Hugame?.gameOver({ score: 42 });
```

## Scores

Declare the `scores` capability and matching score settings in the manifest before using scores. Send a score when it changes, not every animation frame. Send `gameOver({ score: finalScore })` once per finished round. Scores must be finite numbers within the runtime's supported bounds; use small nonnegative integers for ordinary point-based games.

Guests can play but cannot save leaderboard scores. Leaderboards are per published version and keep the player's best score according to the manifest's order. Scores are client-reported and not cheat-proof; do not promise secure competitions or prizes.

The site verifies the sending frame and game/version identifiers. Scores are signed 32-bit integers from −2,147,483,648 through 2,147,483,647. Omitting the score uses the last reported value.

## Lifecycle events

```js
const unsubscribe = window.Hugame?.on("pause", pauseGame);
window.Hugame?.on("resume", resumeGame);
window.Hugame?.on("mute", ({ muted }) => setMuted(muted));
window.Hugame?.on("viewport", ({ width, height, scale, expanded }) =>
  resizeGame(),
);
```

The host sends initial lifecycle, mute and viewport state on readiness, then sends changes. Events may repeat; handlers must be idempotent. Pause simulation, timers and audio on pause; resume only from a paused state. The host sends pause when the browser tab is hidden or the player presses Pause. Stop unloads the iframe; save checkpoints while playing, not during unload. Mute is cooperative: games with audio must handle it.

Readiness is also sent on DOMContentLoaded.

## Local debugging

With Node.js 22 or later, run `npx hugame dev GAME_FOLDER` instead of adding a mock SDK to the game. The loopback player injects the production bridge and sandbox, reloads after valid file changes, logs runtime calls, emulates progress and achievements in browser storage, and provides lifecycle and viewport controls. Use its reset control to test a new player. Local state is only for debugging and never becomes a Hugame account save or achievement. Without compatible Node.js, test the static game directly and state that the Hugame bridge and sandbox were not exercised. See [CLI commands and no-CLI workflows](commands.md#test-dev) for the static-server and browser checklist. A private uploaded preview remains the final check before publication.

## Progress

Enable `progress` in `capabilities`. A game has one JSON-object checkpoint per player, independent of published version:

```js
const saved = await Hugame.progress.load();
// { data: null | object, schemaVersion, revision, storage }
if (saved.data) restoreGame(saved.data, saved.schemaVersion);
const result = await Hugame.progress.save(
  { level: 3, checkpoint: "castle-entrance", coins: 82 },
  { schemaVersion: 1 },
);
```

Load before saving. The SDK remembers the loaded revision and serializes load/save calls. A competing tab's newer save causes `save_conflict`; load and resolve it instead of blindly overwriting. `schemaVersion` describes your save format (1–65535), not the game build; the default is 1. Migrate known older schemas and refuse to overwrite unknown newer formats. JSON data is limited to 32 KiB of UTF-8. Save at meaningful checkpoints, not every frame. Promise rejections have `code` and `message`; show failures without claiming progress was saved. A timeout is an uncertain outcome: load before retrying.

`storage` is `cloud` for signed-in players, `device` for guests, or `preview`. Guest data stays in that browser and does not automatically merge into an account; restart the player after signing in. Private previews use in-memory test data cleared on Stop/restart; they never award real achievements or overwrite public saves. Cloud failures are not silently treated as successful local saves. Browser storage can be unavailable or cleared.

## Achievements

Enable `achievements` and declare definitions in `hugame.json`. IDs are stable across uploads; do not recycle them for a different milestone or change an existing achievement's meaning/target.

```js
const current = await Hugame.achievements.list(); // { storage, achievements: [...] }
await Hugame.achievements.unlock("first-win");
await Hugame.achievements.setProgress("collect-coins", 42);
```

`setProgress` reports an absolute cumulative total, not an increment or current wallet balance. Progress only increases and is capped at the target. Reaching the target unlocks once. `unlock` immediately reaches the target. Mutations return the definition, `value`, `unlockedAt`, `newlyUnlocked`, and `storage`. The host displays the achievement list and unlock notice. Up to 100 definitions per package and 1,000 stored IDs across a game's lifetime. This first version has no icons or hidden achievements.

## Display and containment

For a fixed game, declare `display: { mode: "fixed", width: 360, height: 640 }`. The iframe uses that logical viewport and the host scales the entire frame uniformly to fit its available width **and** height. All game content and controls must fit inside those dimensions. Keep canvas drawing coordinates consistent with its CSS bounds for touch input.

For `display: { mode: "responsive" }`, fit the layout to the iframe's changing viewport. Responsive games use a stable 920 × 575 (16:10) stage on desktop; phones use the available width and up to 70% of the visible viewport height, while expanded mode uses the available screen. Observe the game container with ResizeObserver; constrain canvas and controls to available height, not only width. Every package must explicitly choose `fixed` or `responsive`. Top-level `orientation` remains a preference, not an orientation lock.

Neither mode scrolls the game document. Responsive games receive the stage's current dimensions and must reflow to fit them. For fixed games, the runtime observes rendered content size; if either dimension exceeds the declared viewport, Hugame uniformly scales and centers the entire iframe so both visual bounds fit inside the stage. It never enlarges a smaller fixed game. Avoid nested scroll areas.

Wheel gestures over the iframe scroll the surrounding Hugame page by default. If the game deliberately uses the wheel as a control, register a non-passive `wheel` listener and call `event.preventDefault()` for the gestures it consumes; those gestures stay with the game and are not forwarded to the page. Do not cancel ordinary wheel events unnecessarily.

Full-page and fullscreen modes lock surrounding page scrolling and account for phone safe areas. Escape returns to the page. Test portrait/landscape phones, short landscape screens, keyboard focus, wheel behavior, and the bottommost controls.

## Request limits

Requests have a 20-second timeout, at most 16 pending operations, and a 120/minute player limit; the authenticated API also rate-limits per account. The server checks account suspension, current publication, capabilities, achievement IDs, revisions, and byte limits. Achievements, like scores, are casual client-reported accomplishments, not suitable for prizes or anti-cheat claims.
