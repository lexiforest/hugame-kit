# CLI commands and no-CLI workflows

Use this reference for any Hugame command or when Node.js is unavailable. The preferred command form is `npx hugame`. Never reproduce authenticated operations with `curl`, hand-built API requests, or copied credentials.

## Select a mode

Run `node --version` first.

- With Node.js 22 or later, run `npx hugame --version`, then use the CLI workflow. `npx` may need network access to obtain the package and may require the user's approval in a restricted environment.
- Without compatible Node.js, use the matching no-CLI workflow below. Do not install Node unless the user asks. Clearly distinguish a written-format check or ordinary browser test from CLI validation and Hugame-runtime testing.

Local creation, inspection, validation, packing, and testing do not need a Hugame account. Login, upload, publishing, account inspection, and remote device revocation affect an external account and require the account holder's participation or permission.

## Command map

| Command | What the CLI does | Without the CLI |
| --- | --- | --- |
| `--help` | Lists commands and options. | Use this reference. |
| `--version` | Reports CLI and package-schema versions. | Read the installed skill/package metadata; do not claim a CLI version was executed. |
| `init [folder]` | Creates a validated Star Catcher starter in an empty folder; defaults to `my-game`. | Copy the contents of `assets/star-catcher/` into an empty folder. |
| `validate [folder]` | Checks a game directory without changing it; defaults to the current directory. | Perform the text-based package check below. |
| `pack [folder]` | Validates and creates a reproducible ZIP; defaults to the current directory. | Check the package, then archive its contents using an available OS tool. |
| `dev [folder]` | Runs the local Hugame sandbox, bridge, lifecycle controls, viewport controls, logs, and local test state. | Use an ordinary static server or open the page directly, then follow the browser checklist below. Bridge behavior still requires a private preview. |
| `login` | Starts browser device authorization and stores a scoped device credential. | Sign in on the website. This does not create CLI credentials, but it enables web upload and management. |
| `upload [folder]` | Validates, packs, uploads, and finalizes a new private draft or replacement. | Create a ZIP and use the website's Upload page. |
| `publish <game-or-version>` | Shares a checked version as public or unlisted after explicit `--yes`. | Use My Games after checking the private preview and confirming visibility/download settings. |
| `games` | Lists the signed-in account's games and version IDs. | Open My Games on the website. |
| `whoami` | Shows the current account without exposing its token. | Open the account/profile page on the selected site. |
| `logout` | Tries to revoke the device credential, then removes it locally even if revocation fails. | Revoke the device under Account → Paired devices. Website sign-out alone does not clear a CLI credential on another computer. |

## Create: `init`

```sh
npx hugame init my-game
```

The destination must be empty. The command copies the bundled Star Catcher package, checks that it can be read as a Hugame game, and refuses to overwrite an existing project.

Without the CLI, copy the contents of this skill's `assets/star-catcher/` directory into a new empty folder. Keep `hugame.json`, `index.html`, and exactly one cover at the folder root. Adapt the starter to the user's game; do not present unchanged Star Catcher as the result.

## Check: `validate`

```sh
npx hugame validate GAME_FOLDER
npx hugame validate GAME_FOLDER --json
```

Validation is read-only. It checks package layout, paths, file count and sizes, file signatures, JSON and manifest rules, the cover, local references, and common unsafe HTML/JavaScript patterns. A successful result reports the title, file count, extracted bytes, and schema version. It does not play the game.

Without the CLI, read [package format](package.md) and inspect all of the following:

1. The output is a dedicated game folder. Its root contains `hugame.json`, `index.html`, and exactly one `cover.png` or `cover.webp`; all other files are under `assets/`, `scripts/`, or `styles/`.
2. `hugame.json` is valid JSON and matches every required field and conditional rule in the package reference. Unknown fields are not allowed.
3. The cover's real format matches its extension, is exactly 16:10, is at least 640 × 400, and is no larger than 2 MiB.
4. There are at most 500 files, no file exceeds 25 MiB, total extracted size is at most 100 MiB, and the final ZIP is at most 50 MiB.
5. Paths are relative, case-consistent, shorter than 241 characters, and contain no links, traversal, hidden components, special files, or case-colliding names.
6. Every `src`, `href`, `poster`, CSS `url()`/`@import`, and static JavaScript import points to an existing local file with exact letter case.
7. HTML contains no embedded pages, forms, base URL, `srcdoc`, `srcset`, or HTTP-equivalent metadata. Code contains no network APIs, workers, dynamic script creation/import, `eval`, or `new Function`.
8. Open text files as UTF-8 and media files in an appropriate viewer so renamed or corrupt files are caught.

Report that this was a written-format inspection, not `hugame validate`; the server remains authoritative when the ZIP is uploaded.

## Archive: `pack`

```sh
npx hugame pack GAME_FOLDER
npx hugame pack GAME_FOLDER --out /path/to/game.zip
```

`pack` runs the same directory validation as `validate`, sorts file paths, normalizes ZIP timestamps and permissions, creates the archive, and validates the finished ZIP. The same inputs therefore produce the same bytes. By default it writes `<folder-name>.zip` beside the game folder. The output must be outside the game folder, its parent directory must already exist, and the command refuses to overwrite a file.

`upload` does not require a separate `pack`; it performs the same validated packing internally. Use `pack` when the user needs a ZIP for the web uploader, sharing, or archival verification.

Without the CLI, complete the text-based check first. Use the operating system's archive tool to ZIP the contents of the game folder so `hugame.json`, `index.html`, and the cover are at the archive root; save the ZIP outside the game folder. For example, from a clean dedicated output folder on macOS or Linux:

```sh
cd GAME_FOLDER
zip -X -r ../game.zip .
```

On Windows PowerShell, select the folder's contents rather than the enclosing folder:

```powershell
Compress-Archive -Path "GAME_FOLDER\*" -DestinationPath "game.zip"
```

Inspect the archive listing before upload and ensure it is at most 50 MiB. A system-created ZIP is not guaranteed to be reproducible and has not received the CLI's pre- and post-pack validation.

## Test: `dev`

```sh
npx hugame dev GAME_FOLDER
npx hugame dev GAME_FOLDER --port 4173 --no-open
```

The command first validates the package. It serves only package files on loopback, watches valid changes, and reloads the game inside the production-style opaque-origin sandbox. The player injects the real runtime bridge, provides 920 × 575, 390 × 700, and 844 × 390 viewports, sends pause/resume/mute/viewport events, logs runtime activity, and emulates progress and achievements in browser storage. Reset local state when testing first-run behavior. Stop the server with Ctrl+C. Local state is test data and never becomes account data.

Without the CLI, use the first static-server option already available on the computer, for example:

```sh
python3 -m http.server 4173 --directory GAME_FOLDER
php -S 127.0.0.1:4173 -t GAME_FOLDER
ruby -run -e httpd GAME_FOLDER -p 4173
```

If no static server is available, open `index.html` directly; module scripts and some relative-path behavior may differ under `file:` URLs. Then:

1. Use browser developer tools to test 920 × 575, 390 × 700, and 844 × 390. Confirm no horizontal or vertical scrolling, clipped controls, or pointer-coordinate mismatch.
2. Play a complete round. Test restart, keyboard, pointer, and touch controls where supported; inspect console errors and missing asset requests.
3. Switch tabs or minimize the browser and confirm any native visibility handling pauses timers/audio. This does not simulate Hugame's bridge events.
4. Review pause, resume, mute, viewport, score, game-over, progress, and achievement handlers against [runtime bridge](runtime.md).

Do not add a replacement or mock `window.Hugame` SDK to the package. Static testing cannot reproduce the Hugame sandbox, runtime event controls, score submission, saves, achievements, or runtime log. Test those in `npx hugame dev` when Node becomes available or in a private uploaded preview. State exactly which path was tested.

## Connect: `login`, `whoami`, `games`, and `logout`

```sh
npx hugame login --site https://hugame.dev
npx hugame login --site https://hugame.dev --name "My computer" --no-open
npx hugame whoami --site https://hugame.dev
npx hugame games --site https://hugame.dev
npx hugame logout --site https://hugame.dev
```

`login` displays a short-lived browser approval URL/code and waits while the account holder signs in and approves that device. Leave it running. Never approve for the user, request their password/token, or print/read the credentials file. Production is `https://hugame.dev`; staging is `https://staging.hugame.dev`. `whoami` returns account information; `games` returns owned games and version IDs. `logout` clears the selected local credential even if the server cannot be reached and reports whether server revocation succeeded.

Without the CLI, sign in normally on the intended website. Use the profile/account page instead of `whoami`, My Games instead of `games`, and Account → Paired devices instead of `logout` when revoking a previously authorized CLI device. Do not emulate device login or authenticated API calls.

## Transfer: `upload`

```sh
npx hugame upload GAME_FOLDER --site https://hugame.dev
npx hugame upload GAME_FOLDER --game GAME_ID --site https://hugame.dev
```

The command validates and packs the folder, uploads it with an integrity checksum, and finalizes it. A new upload becomes a private draft and returns a private preview URL. An explicit `--game` or a game association remembered from an earlier upload of the same folder permanently replaces that game's sole current version while preserving visibility, forkability, and other settings. Confirm the exact game ID with `games` and get permission before replacement. The CLI can resume an interrupted finalization, so retry the unchanged folder once before starting another upload.

Without the CLI, create the ZIP as described under `pack`, sign in on the intended site, and use Upload. For a replacement, open My Games and choose that game's Replace action so the page includes its game ID; confirm the warning before uploading. Do not use a plain new upload when the intent is to replace an existing game. Check the returned private preview or live play page as appropriate.

## Share: `publish`

```sh
npx hugame publish VERSION_ID --site https://hugame.dev --visibility public --forkable false --yes
npx hugame publish VERSION_ID --site https://hugame.dev --visibility unlisted --forkable true --yes
```

Publishing requires a game or version ID owned by the connected account and refuses to run without `--yes`. Prefer the preview's version ID. `public` may appear in the arcade; `unlisted` is accessible to anyone with the play link. `--forkable true` permits source-ZIP downloads and changes the game's setting before publication. Omit `--forkable` to preserve its current setting. The CLI does not provide an unpublish command; use My Games for private visibility.

Without the CLI, open My Games after testing the private preview. Show the user the exact title, version, target site, visibility, and source-download setting; get explicit confirmation; then change those settings in the website. Return the play URL and the resulting visibility/download state.

## Options and output

- `--help` or `-h` prints command help; `--version` reports CLI and schema versions.
- `--site ORIGIN` selects production, staging, or an allowed localhost development origin for account commands.
- `--json` emits one JSON object per line; login emits a device-authorization object before its final result.
- `--no-open` prevents `login` or `dev` from opening a browser automatically.
- `--port NUMBER` selects the `dev` port from 0 through 65535; `0` requests an available port.
- `--name LABEL` labels the device during login.
- `--out FILE.zip` selects the pack destination.
- `--game GAME_ID` selects the existing game replaced by upload.
- `--visibility public|unlisted`, `--forkable true|false`, and `--yes` control publication.

When no CLI is available, there is no equivalent to `--json`; report observations in plain text and never imply machine validation or an authenticated command succeeded.
